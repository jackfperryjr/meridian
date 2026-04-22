import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { outputLinesAtom, type OutputLine } from '../../store/game'
import type { Highlight } from '../ui/HighlightsModal'

const PRESET_CLASS: Record<string, string> = {
  echo:           'preset-echo',
  'echo-script':  'preset-echo-script',
  roomname:       'preset-roomname',
  roomdesc:       'preset-roomdesc',
  whisper:        'preset-whisper',
  speech:         'preset-speech',
  thought:        'preset-thought',
  bonus:          'preset-bonus',
  penalty:        'preset-penalty',
  warning:        'preset-warning',
  'col-1':        'preset-col1',
  'col-2':        'preset-col2',
  'col-3':        'preset-col3',
}

function matchHighlight(text: string, highlights: Highlight[]): Highlight | null {
  for (const hl of highlights) {
    if (!hl.enabled || !hl.pattern) continue
    try {
      if (hl.isRegex) {
        if (new RegExp(hl.pattern, 'i').test(text)) return hl
      } else {
        if (text.toLowerCase().includes(hl.pattern.toLowerCase())) return hl
      }
    } catch { /* invalid regex */ }
  }
  return null
}

function GameLine({ line, highlights }: { line: OutputLine; highlights: Highlight[] }) {
  const hl = matchHighlight(line.text, highlights)

  const classList = [
    'game-line',
    ...(line.styles.map(s =>
      s.preset ? (PRESET_CLASS[s.preset] ?? '') :
      s.bold   ? 'text-bold' : ''
    ))
  ].filter(Boolean)

  const style: React.CSSProperties = {}

  if (hl) {
    if (hl.color)  style.color      = hl.color
    if (hl.bgcolor) style.background = hl.bgcolor
    if (hl.bold)   style.fontWeight  = 'bold'
  } else {
    if (line.styles[0]?.color) style.color = line.styles[0].color
    if (line.styles[0]?.bold)  style.fontWeight = 'bold'
  }

  return (
    <div className={classList.join(' ')} style={style}>
      {line.text}
    </div>
  )
}

let _highlights: Highlight[] = []
export function setHighlights(h: Highlight[]) { _highlights = h }

export function GameOutput() {
  const lines        = useAtomValue(outputLinesAtom)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const hlRef        = useRef<Highlight[]>(_highlights)

  // Keep hlRef in sync
  useEffect(() => {
    const interval = setInterval(() => {
      hlRef.current = _highlights
    }, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [lines])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  return (
    <div ref={containerRef} className="game-output" onScroll={handleScroll}>
      {lines.map(line => (
        <GameLine key={line.id} line={line} highlights={hlRef.current} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
