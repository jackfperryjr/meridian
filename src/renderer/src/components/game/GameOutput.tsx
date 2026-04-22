import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { outputLinesAtom, type OutputLine } from '../../store/game'

// SGE preset → CSS class mapping
const PRESET_CLASS: Record<string, string> = {
  echo:        'preset-echo',
  'echo-script': 'preset-echo-script',
  roomname:   'preset-roomname',
  roomdesc:   'preset-roomdesc',
  whisper:    'preset-whisper',
  speech:     'preset-speech',
  thought:    'preset-thought',
  bonus:      'preset-bonus',
  penalty:    'preset-penalty',
  warning:    'preset-warning',
  'col-1':    'preset-col1',
  'col-2':    'preset-col2',
  'col-3':    'preset-col3',
}

function GameLine({ line }: { line: OutputLine }) {
  const className = [
    'game-line',
    ...(line.styles.map(s =>
      s.preset ? (PRESET_CLASS[s.preset] ?? '') :
      s.bold   ? 'text-bold' : ''
    ))
  ].filter(Boolean).join(' ')

  const style = line.styles[0]?.color
    ? { color: line.styles[0].color }
    : undefined

  return (
    <div className={className} style={style}>
      {line.text}
    </div>
  )
}

export function GameOutput() {
  const lines = useAtomValue(outputLinesAtom)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Auto-scroll to bottom unless user has scrolled up
  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [lines])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    autoScrollRef.current = atBottom
  }

  return (
    <div
      ref={containerRef}
      className="game-output"
      onScroll={handleScroll}
    >
      {lines.map((line) => (
        <GameLine key={line.id} line={line} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
