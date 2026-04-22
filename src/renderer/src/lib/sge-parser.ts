/**
 * SGE (Simutronics Game Engine) protocol parser.
 * Parses the raw XML stream from the game server into typed events.
 *
 * Key SGE tags for DR:
 *   <room id="..." title="[Room Name]"/>    — room identity
 *   <roomName>Name</roomName>               — room name text
 *   <roomDesc>Desc</roomDesc>               — room description text
 *   <component id="room desc">...</component> — room description (alternate)
 *   <component id="room exits">...</component> — exits
 *   <vitals type="health" value="100"/>     — vital stats (0-100)
 *   <indicator id="IconBLEEDING" visible="y"/> — status indicators
 *   <spell>Spell Name</spell>               — active spell
 *   <roundTime value="1234567890"/>         — roundtime epoch
 *   <castTime value="1234567890"/>          — cast time epoch
 *   <prompt time="1234567890"/>             — game prompt
 *   <preset id="roomName">text</preset>     — styled text
 *   <preset id="speech">text</preset>       — speech text
 *   <inv id="...">text</inv>               — inventory
 */

export type GameEvent =
  | { type: 'text';      text: string; styles: TextStyle[] }
  | { type: 'room';      name: string; description: string; exits: string[] }
  | { type: 'roomName';  name: string }
  | { type: 'roomDesc';  description: string }
  | { type: 'vitals';    field: VitalField; value: number; max: number }
  | { type: 'indicator'; id: string; active: boolean }
  | { type: 'spell';     name: string }
  | { type: 'roundtime'; expires: number }
  | { type: 'cast_time'; expires: number }
  | { type: 'prompt';    time: number }
  | { type: 'inv';       text: string }

export type VitalField = 'health' | 'mana' | 'stamina' | 'spirit' | 'encumbrance'

export interface TextStyle {
  bold?:   boolean
  color?:  string
  preset?: string
}

const TAG_RE = /<([^>]+)>|([^<]+)/g

function decodeEntities(s: string): string {
  return s
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

export function parseLine(line: string): GameEvent[] {
  const events: GameEvent[] = []
  let styles:   TextStyle[] = []
  let buf       = ''
  let inRoomDesc = false
  let inRoomName = false
  let inInv      = false

  const flush = (forcePreset?: string) => {
    // Normalize internal newlines/excess whitespace within a chunk
    const text = buf.replace(/\n/g, ' ').replace(/ {2,}/g, ' ')
    buf = ''
    if (!text.trim() || text.trim() === '>') return
    const s = forcePreset ? [{ preset: forcePreset }] : [...styles]
    events.push({ type: 'text', text, styles: s })
  }

  if (!line.includes('<')) {
    const decoded = decodeEntities(line)
    // Bare ">" lines are prompt echoes from Lich — suppress them
    if (decoded.trim() && decoded.trim() !== '>') {
      events.push({ type: 'text', text: decoded, styles: [] })
    }
    return events
  }

  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = TAG_RE.exec(line)) !== null) {
    const [, tag, text] = m

    if (text !== undefined) {
      buf += decodeEntities(text)
      continue
    }
    if (!tag) continue

    // Parse tag name and attributes
    const spaceIdx = tag.search(/\s/)
    const tagName  = (spaceIdx === -1 ? tag : tag.slice(0, spaceIdx)).toLowerCase()
    const isClose  = tagName.startsWith('/')
    const attrs    = parseAttrs(tag)

    switch (tagName) {

      // ── Room name ──────────────────────────────────────────────────────────
      case 'roomname':
        flush()
        inRoomName = true
        styles = [{ preset: 'roomname' }]
        break
      case '/roomname':
        if (inRoomName && buf.trim()) {
          events.push({ type: 'roomName', name: buf.trim() })
          flush('roomname')
        }
        inRoomName = false
        styles = []
        break

      // ── Room description ───────────────────────────────────────────────────
      case 'roomdesc':
        flush()
        inRoomDesc = true
        styles = [{ preset: 'roomdesc' }]
        break
      case '/roomdesc':
        if (inRoomDesc && buf.trim()) {
          events.push({ type: 'roomDesc', description: buf.trim() })
          flush('roomdesc')
        }
        inRoomDesc = false
        styles = []
        break

      // ── Component blocks (room desc, exits, etc.) ──────────────────────────
      case 'component': {
        const id = attrs['id'] ?? ''
        flush()
        if (id === 'room desc') {
          inRoomDesc = true
          styles = [{ preset: 'roomdesc' }]
        } else if (id === 'room objs' || id === 'room players' || id === 'room exits') {
          styles = [{ preset: 'roomexits' }]
        } else {
          styles = []
        }
        break
      }
      case '/component':
        if (inRoomDesc && buf.trim()) {
          events.push({ type: 'roomDesc', description: buf.trim() })
          flush('roomdesc')
        }
        inRoomDesc = false
        styles = []
        break

      // ── Vitals ─────────────────────────────────────────────────────────────
      // DR sends: <stat name="health" value="100" max="100"/>
      // or older: <vitals type="health" value="100"/>
      case 'stat':
      case 'vitals': {
        flush()
        const vtype = ((attrs['name'] ?? attrs['type']) ?? '').toLowerCase() as VitalField
        const val   = parseInt(attrs['value'] ?? '0', 10)
        const max   = parseInt(attrs['max']   ?? '100', 10)
        const validFields: VitalField[] = ['health','mana','stamina','spirit','encumbrance']
        if (validFields.includes(vtype)) {
          events.push({ type: 'vitals', field: vtype, value: val, max: max || 100 })
        }
        break
      }

      // ── Indicator ──────────────────────────────────────────────────────────
      case 'indicator':
        flush()
        events.push({
          type:   'indicator',
          id:     (attrs['id'] ?? '').replace(/^Icon/, '').toLowerCase(),
          active: attrs['visible'] === 'y'
        })
        break

      // ── Spell ──────────────────────────────────────────────────────────────
      case 'spell':
        flush()
        events.push({ type: 'spell', name: attrs['spell'] ?? buf.trim() })
        buf = ''
        break

      // ── Timers ─────────────────────────────────────────────────────────────
      case 'roundtime':
        flush()
        events.push({ type: 'roundtime', expires: parseInt(attrs['value'] ?? '0', 10) * 1000 })
        break
      case 'casttime':
        flush()
        events.push({ type: 'cast_time', expires: parseInt(attrs['value'] ?? '0', 10) * 1000 })
        break

      // ── Prompt ─────────────────────────────────────────────────────────────
      case 'prompt':
        flush()
        events.push({ type: 'prompt', time: parseInt(attrs['time'] ?? '0', 10) })
        break

      // ── Inventory ──────────────────────────────────────────────────────────
      case 'inv':
        flush()
        inInv = true
        styles = [{ preset: 'inv' }]
        break
      case '/inv':
        if (inInv && buf.trim()) {
          events.push({ type: 'inv', text: buf.trim() })
          buf = ''
        }
        inInv = false
        styles = []
        break

      // DR hand slots — show in output stream styled
      case 'left':
      case 'right':
        flush()
        styles = [{ preset: tagName }]
        break
      case '/left':
      case '/right':
        flush()
        styles = []
        break

      // ── Styled text ────────────────────────────────────────────────────────
      case 'preset':
        flush()
        styles = attrs['id'] ? [{ preset: attrs['id'] }] : []
        break
      case '/preset':
        flush()
        styles = []
        break

      case 'style':
        flush()
        styles = attrs['id'] ? [{ preset: attrs['id'] }] : []
        break
      case '/style':
        flush()
        styles = []
        break

      case 'color':
        flush()
        styles = attrs['fg'] ? [{ color: attrs['fg'] }] : []
        break
      case '/color':
        flush()
        styles = []
        break

      case 'bold':
        flush()
        styles = [{ bold: true }]
        break
      case '/bold':
        flush()
        styles = []
        break

      // ── Ignore structural/layout tags ──────────────────────────────────────
      case 'pushbold':
      case '/pushbold':
      case 'popbold':
      case '/popbold':
      case 'output':
      case '/output':
      case 'mode':
      case 'settingsinfo':
      case '/settingsinfo':
      case 'opendialog':
      case 'dialogdata':
      case '/dialogdata':
      case 'pushstream':
      case '/pushstream':
      case 'popstream':
      case 'streamwindow':
        flush()
        break

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
  const re  = /(\w[\w-]*)(?:="([^"]*)")?/g
  let m: RegExpExecArray | null
  let first = true
  while ((m = re.exec(tag)) !== null) {
    if (first) { first = false; continue } // skip tag name
    out[m[1]] = m[2] ?? ''
  }
  return out
}
