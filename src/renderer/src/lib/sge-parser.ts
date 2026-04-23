/**
 * SGE stream parser for DragonRealms / Lich StormFront protocol.
 *
 * Key tag patterns:
 *   <component id='exp SkillName'><preset id='whisper'><d cmd='skill X'>Abbr</d>: rank% [mind]</preset></component>
 *   <component id='room desc'>...</component>
 *   <component id='room exits'>...</component>
 *   <pushStream id='combat'/> ... </stream>
 *   <pushStream id='atmo'/>   ... </stream>
 *   <d cmd='go north'>north</d>   — clickable link
 */

export type StreamId = 'main' | 'exp' | 'combat' | 'atmo' | 'inv' | 'familiar' | 'speech'

export interface TextStyle {
  bold?:   boolean
  color?:  string
  preset?: string
}

export interface LinkSpan {
  text: string
  cmd:  string
}

export type GameEvent =
  | { type: 'text';      text: string;   styles: TextStyle[]; stream: StreamId; links?: LinkSpan[] }
  | { type: 'roomName';  name: string }
  | { type: 'roomDesc';  description: string }
  | { type: 'roomExits'; exits: string[] }
  | { type: 'expSkill';  name: string; rank: number; pct: number; mind: string }
  | { type: 'expMeta';   tdps?: number; favors?: number }
  | { type: 'vitals';    field: VitalField; value: number; max: number }
  | { type: 'indicator'; id: string; active: boolean }
  | { type: 'spell';     name: string }
  | { type: 'roundtime'; expires: number }
  | { type: 'cast_time'; expires: number }
  | { type: 'prompt';    time: number }

export type VitalField = 'health' | 'mana' | 'stamina' | 'spirit' | 'encumbrance'

// ── Module-level stream state ──────────────────────────────────────────────────
let _stream:     StreamId = 'main'
let _inRoomDesc  = false
let _inRoomName  = false
let _inExits     = false
let _suppressComp = false  // swallow room objs/players components
let _inExpSkill  = ''    // skill name when inside <component id='exp X'>
let _roomDescBuf = ''
let _roomExitBuf = ''

function decodeEntities(s: string): string {
  return s
    .replace(/&gt;/g,   '>')
    .replace(/&lt;/g,   '<')
    .replace(/&amp;/g,  '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

const TAG_RE = /<([^>]+)>|([^<]+)/g

export function parseLine(raw: string): GameEvent[] {
  const events: GameEvent[] = []
  let styles: TextStyle[]   = []
  let buf    = ''
  let links: LinkSpan[]     = []
  let inLink = false
  let linkCmd = ''
  let linkBuf = ''

  const flush = (forcePreset?: string) => {
    let text = buf.replace(/[\r\n]+/g, ' ').replace(/  +/g, ' ').trim()
    buf = ''
    if (!text || text === '>') return
    const s  = forcePreset ? [{ preset: forcePreset }] : [...styles]
    const ls = links.length > 0 ? [...links] : undefined
    links = []
    // Route to correct stream
    if (_inRoomDesc) { _roomDescBuf += ' ' + text; return }
    if (_inExits)    { _roomExitBuf += ' ' + text; return }
    events.push({ type: 'text', text, styles: s, stream: _stream, links: ls })
  }

  // ── Plain-text line (no XML) ───────────────────────────────────────────────
  if (!raw.includes('<')) {
    const text = decodeEntities(raw).trim()
    if (!text || text === '>') return events
    if (_inRoomDesc) { _roomDescBuf += ' ' + text; return events }
    if (_inExits)    { _roomExitBuf += ' ' + text; return events }
    events.push({ type: 'text', text, styles: [], stream: _stream })
    return events
  }

  // ── XML line ───────────────────────────────────────────────────────────────
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = TAG_RE.exec(raw)) !== null) {
    const [, tag, textNode] = m
    if (textNode !== undefined) {
      const decoded = decodeEntities(textNode)
      if (inLink) linkBuf += decoded
      else buf += decoded
      continue
    }
    if (!tag) continue

    const spaceIdx = tag.search(/\s/)
    const rawName  = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx)
    const tagName  = rawName.toLowerCase().replace(/\/$/, '')
    const isClose  = tagName.startsWith('/')
    const attrs    = parseAttrs(tag)

    switch (tagName) {

      // ── Clickable link: <d cmd='go north'>north</d> ──────────────────────
      case 'd': {
        flush()
        inLink  = true
        linkCmd = attrs['cmd'] ?? ''
        linkBuf = ''
        break
      }
      case '/d': {
        if (inLink && linkBuf.trim()) {
          links.push({ text: linkBuf.trim(), cmd: linkCmd })
          buf += linkBuf  // also append to text buffer so it shows
        }
        inLink  = false
        linkCmd = ''
        linkBuf = ''
        break
      }

      // ── Component: exp, room desc, room exits ─────────────────────────────
      case 'component': {
        flush()
        const id = (attrs['id'] ?? '').toLowerCase()
        if (id.startsWith('exp ')) {
          _inExpSkill = (attrs['id'] ?? '').slice(4).trim()  // preserve case
        } else if (id === 'room desc') {
          _inRoomDesc  = true
          _roomDescBuf = ''
          styles = [{ preset: 'roomdesc' }]
        } else if (id === 'room exits') {
          _inExits     = true
          _roomExitBuf = ''
          styles = [{ preset: 'roomexits' }]
        } else if (id.startsWith('room')) {
          // room objs, room players — swallow, don't emit to game panel
          _suppressComp = true
          styles = []
        } else {
          styles = []
        }
        break
      }
      case '/component': {
        if (_inExpSkill) {
          // Parse: "     Aug:  305 66%  [ 1/34]"  (abbr already in buf)
          const raw2 = buf.replace(/[\r\n]+/g, ' ').trim()
          buf = ''
          const sm = raw2.match(/:?\s*(\d+)\s+(\d+)%\s+\[\s*(\d+\/\d+)\s*\]/)
          if (sm) {
            events.push({
              type: 'expSkill',
              name: _inExpSkill,
              rank: parseInt(sm[1]),
              pct:  parseInt(sm[2]),
              mind: sm[3],
            })
          } else {
            // TDP / favor line: "TDPs: 3348  Favors: 50"
            const tdpM = raw2.match(/TDPs?:\s*(\d+)/i)
            const favM = raw2.match(/Favors?:\s*(\d+)/i)
            if (tdpM || favM) {
              events.push({
                type:   'expMeta',
                tdps:   tdpM ? parseInt(tdpM[1]) : undefined,
                favors: favM ? parseInt(favM[1]) : undefined,
              })
            }
          }
          _inExpSkill = ''
          styles = []
        } else if (_suppressComp) {
          buf = ''
          _suppressComp = false
          styles = []
        } else if (_inRoomDesc) {
          const raw3 = (_roomDescBuf + ' ' + buf).replace(/[\r\n]+/g, ' ').replace(/  +/g, ' ').trim()
          buf = ''
          _roomDescBuf = ''
          _inRoomDesc  = false
          if (raw3) {
            events.push({ type: 'roomDesc', description: raw3 })
          }
          styles = []
        } else if (_inExits) {
          const raw2 = (_roomExitBuf + ' ' + buf).replace(/[\r\n,\.]+/g, ' ').replace(/  +/g, ' ').trim()
          buf = ''
          _roomExitBuf = ''
          _inExits     = false
          if (raw2) {
            const exitLinks = links.filter(l => l.cmd.startsWith('go '))
            links = []
            const DIRS = new Set(['north','south','east','west','northeast','northwest',
              'southeast','southwest','up','down','out','in','ne','nw','se','sw','n','s','e','w'])
            const pathPart = raw2.replace(/obvious\s+(?:paths?|exits?)\s*:?\s*/i, '')
            const textExits = pathPart.split(/[\s,\.]+/).map(e => e.trim().toLowerCase()).filter(e => DIRS.has(e))
            const allExits  = exitLinks.length > 0
              ? exitLinks.map(l => l.cmd.replace('go ', ''))
              : textExits
            events.push({ type: 'roomExits', exits: allExits })
            // Build synthetic links from text exits if no <d> tags present
            const finalLinks = exitLinks.length > 0
              ? exitLinks
              : allExits.map(dir => ({ text: dir, cmd: dir }))
            events.push({
              type: 'text', text: raw2,
              styles: [{ preset: 'roomexits' }], stream: 'main',
              links: finalLinks.length > 0 ? finalLinks : undefined
            })
          }
          styles = []
        } else {
          flush()
          styles = []
        }
        break
      }

      // ── Stream switching ──────────────────────────────────────────────────
      case 'clearstream':
        flush()
        // clearStream resets inv panel - emit special event handled in store
        if ((attrs['id'] ?? '').toLowerCase() === 'inv') {
          events.push({ type: 'text', text: '__clear_inv__', styles: [], stream: 'inv' })
        }
        break
      case 'pushstream': {
        flush()
        const id = (attrs['id'] ?? '').toLowerCase()
        const map: Record<string, StreamId> = {
          exp: 'exp', combat: 'combat', atmo: 'atmo',
          inv: 'inv', familiar: 'familiar', speech: 'speech'
        }
        _stream = map[id] ?? 'main'
        break
      }
      case '/stream':
      case 'popstream':
        flush()
        _stream = 'main'
        break

      // ── Room name ─────────────────────────────────────────────────────────
      case 'roomname':
        flush(); _inRoomName = true; styles = [{ preset: 'roomname' }]
        break
      case '/roomname': {
        const name = buf.trim(); buf = ''
        _inRoomName = false; styles = []
        if (name) {
          events.push({ type: 'roomName', name })
          // Don't emit as text — room panel handles display
        }
        break
      }

      // ── Vitals ────────────────────────────────────────────────────────────
      case 'stat':
      case 'vitals': {
        flush()
        const field = ((attrs['name'] ?? attrs['type']) ?? '').toLowerCase() as VitalField
        const val   = parseInt(attrs['value'] ?? '0', 10)
        const max   = parseInt(attrs['max']   ?? '100', 10)
        const valid: VitalField[] = ['health','mana','stamina','spirit','encumbrance']
        if (valid.includes(field)) events.push({ type: 'vitals', field, value: val, max: max || 100 })
        break
      }

      // ── Indicator ─────────────────────────────────────────────────────────
      case 'indicator':
        flush()
        events.push({
          type: 'indicator',
          id:   (attrs['id'] ?? '').replace(/^Icon/, '').toLowerCase(),
          active: attrs['visible'] === 'y'
        })
        break

      // ── Spell ─────────────────────────────────────────────────────────────
      case 'spell':
        flush(); buf = ''; break
      case '/spell':
        if (buf.trim()) events.push({ type: 'spell', name: buf.trim() })
        buf = ''; styles = []; break

      // ── Timers ────────────────────────────────────────────────────────────
      case 'roundtime':
        flush()
        events.push({ type: 'roundtime', expires: parseInt(attrs['value'] ?? '0', 10) * 1000 })
        break
      case 'casttime':
        flush()
        events.push({ type: 'cast_time', expires: parseInt(attrs['value'] ?? '0', 10) * 1000 })
        break

      // ── Prompt ────────────────────────────────────────────────────────────
      case 'prompt':
        flush()
        events.push({ type: 'prompt', time: parseInt(attrs['time'] ?? '0', 10) })
        break

      // ── Styled text ───────────────────────────────────────────────────────
      case 'preset':  flush(); styles = attrs['id'] ? [{ preset: attrs['id'] }] : []; break
      case '/preset': flush(); styles = []; break
      case 'style':   flush(); styles = attrs['id'] ? [{ preset: attrs['id'] }] : []; break
      case '/style':  flush(); styles = []; break
      case 'color':   flush(); styles = attrs['fg'] ? [{ color: attrs['fg'] }] : []; break
      case '/color':  flush(); styles = []; break
      case 'bold':    flush(); styles = [{ bold: true }]; break
      case '/bold':   flush(); styles = []; break
      case 'pushbold': flush(); styles = [{ bold: true }]; break
      case 'popbold':
      case '/pushbold': flush(); styles = []; break

      // ── Ignore ────────────────────────────────────────────────────────────
      case 'output': case '/output':
      case 'mode':
      case 'settingsinfo': case '/settingsinfo':
      case 'opendialog': case '/opendialog':
      case 'dialogdata': case '/dialogdata':
      case 'streamwindow':
      case 'app': case '/app':
      case 'nav': case '/nav':
        flush(); break

      case 'left': case 'right':
        flush(); styles = [{ preset: tagName }]; break
      case '/left': case '/right':
        flush(); styles = []; break

      default:
        if (isClose) { flush(); styles = [] }
        break
    }
  }

  flush()
  return events
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /(\w[\w-]*)(?:=(?:"([^"]*)"|'([^']*)'))?/g
  let m: RegExpExecArray | null
  let first = true
  while ((m = re.exec(tag)) !== null) {
    if (first) { first = false; continue }
    out[m[1]] = m[2] ?? m[3] ?? ''
  }
  return out
}
