import { useAtomValue } from 'jotai'
import { useEffect, useRef, useLayoutEffect } from 'react'
import { outputLinesAtom, type OutputLine } from '../../store/game'
import type { Highlight } from '../ui/HighlightsModal'

const PRESET_CLASS: Record<string, string> = {
  echo:           'preset-echo',
  'echo-script':  'preset-echo-script',
  roomname:       'preset-roomname',
  roomdesc:       'preset-roomdesc',
  roomexits:      'preset-roomexits',
  whisper:        'preset-whisper',
  speech:         'preset-speech',
  thought:        'preset-thought',
  bonus:          'preset-bonus',
  penalty:        'preset-penalty',
  warning:        'preset-warning',
}

function matchHighlight(text: string, highlights: Highlight[]): Highlight | null {
  for (const hl of highlights) {
    if (!hl.enabled || !hl.pattern) continue
    try {
      const match = hl.isRegex
        ? new RegExp(hl.pattern, 'i').test(text)
        : text.toLowerCase().includes(hl.pattern.toLowerCase())
      if (match) return hl
    } catch { /* invalid regex */ }
  }
  return null
}

function GameLine({ line, highlights }: { line: OutputLine; highlights: Highlight[] }) {
  const hl = matchHighlight(line.text, highlights)
  const classList = ['game-line',
    ...line.styles.map(s => s.preset ? (PRESET_CLASS[s.preset] ?? '') : s.bold ? 'text-bold' : '')
  ].filter(Boolean)

  const style: React.CSSProperties = {}
  if (hl) {
    if (hl.color)   style.color      = hl.color
    if (hl.bgcolor) style.background = hl.bgcolor
    if (hl.bold)    style.fontWeight = 'bold'
  } else if (line.styles[0]?.color) {
    style.color = line.styles[0].color
  } else if (line.styles[0]?.bold) {
    style.fontWeight = 'bold'
  }

  // Render with clickable link spans if line has <d cmd> links
  if (line.links && line.links.length > 0) {
    const isExits = line.links.every(l => l.cmd.startsWith('go '))

    if (isExits) {
      const dirs = line.links.map(l => expandCmd(l.cmd))
      return (
        <div className={classList.join(' ')} style={style}>
          <span style={{ color: 'var(--text-dim)' }}>Obvious paths: </span>
          {dirs.map((dir, i) => (
            <span key={dir}>
              <span className="game-link" onClick={() => _sendFn?.(dir)} title={dir}>{dir}</span>
              {i < dirs.length - 1 && <span style={{ color: 'var(--text-dim)' }}>, </span>}
            </span>
          ))}
        </div>
      )
    }

    // Generic link rendering — splice links into surrounding text
    let remaining = line.text
    const parts: React.ReactNode[] = []
    let key = 0
    for (const link of line.links) {
      const idx = remaining.indexOf(link.text)
      if (idx === -1) continue
      if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>)
      parts.push(
        <span
          key={key++}
          className="game-link"
          onClick={() => _sendFn?.(expandCmd(link.cmd))}
          title={link.cmd}
        >
          {link.text}
        </span>
      )
      remaining = remaining.slice(idx + link.text.length)
    }
    if (remaining) parts.push(<span key={key++}>{remaining}</span>)
    return <div className={classList.join(' ')} style={style}>{parts}</div>
  }

  return <div className={classList.join(' ')} style={style}>{line.text}</div>
}


// Strip "go " prefix — DR accepts bare directions: sw, n, northeast, etc.
function expandCmd(cmd: string): string {
  return cmd.replace(/^go\s+/, '')
}

let _highlights: Highlight[] = []
export function setHighlights(h: Highlight[]) { _highlights = h }

let _sendFn: ((cmd: string) => void) | null = null
export function setSendFn(fn: (cmd: string) => void) { _sendFn = fn }

export function GameOutput() {
  const lines        = useAtomValue(outputLinesAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  // Track whether user has scrolled up — use ref not state to avoid re-renders
  const userScrolled = useRef(false)

  // Use layoutEffect so scroll happens synchronously after DOM update,
  // preventing the flash of un-scrolled content
  useLayoutEffect(() => {
    if (!userScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  })

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    userScrolled.current = !atBottom
  }

  return (
    <div ref={containerRef} className="game-output" onScroll={handleScroll}>
      {lines.map(line => (
        <GameLine key={line.id} line={line} highlights={_highlights} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
