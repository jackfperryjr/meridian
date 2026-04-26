import { useState, useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { handsAtom } from '../../store/game'
export type { ConnectionStatus } from '../../store/game'
import type { ConnectionStatus } from '../../store/game'
import { IconCog, IconSparkles, IconChevron, IconWinMinimize, IconWinMaximize, IconWinRestore, IconWinClose } from '../ui/Icons'

// ── CommandInput ──────────────────────────────────────────────────────────────
export function CommandInput({ onSend, onEcho }: {
  onSend: (cmd: string) => void
  onEcho: (cmd: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<string[]>([])
  const histIdxRef = useRef(-1)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    const val = inputRef.current?.value.trim()
    if (!val) return
    onEcho(val)
    onSend(val)
    historyRef.current = [val, ...historyRef.current.slice(0, 99)]
    histIdxRef.current = -1
    if (inputRef.current) inputRef.current.value = ''
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { submit(); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(histIdxRef.current + 1, historyRef.current.length - 1)
      histIdxRef.current = next
      if (inputRef.current) inputRef.current.value = historyRef.current[next] ?? ''
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(histIdxRef.current - 1, -1)
      histIdxRef.current = next
      if (inputRef.current) inputRef.current.value = next === -1 ? '' : historyRef.current[next] ?? ''
    }
  }

  return (
    <div className="command-input-wrap">
      <span className="command-prompt">&gt;</span>
      <input
        ref={inputRef}
        className="command-input"
        type="text"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}

// ── Hand display ─────────────────────────────────────────────────────────────
function HandDisplay() {
  const hands = useAtomValue(handsAtom)
  const empty = <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>empty</span>
  return (
    <div className="hand-display">
      <span className="hand-label">R:</span>
      <span className="hand-item">{hands.right ? hands.right : empty}</span>
      <span className="hand-sep">|</span>
      <span className="hand-label">L:</span>
      <span className="hand-item">{hands.left ? hands.left : empty}</span>
    </div>
  )
}

// ── Window controls (custom min/max/close) ────────────────────────────────────
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)
  const platform = window.dr.app.platform

  useEffect(() => {
    if (platform === 'darwin') return
    window.dr.window.isMaximized().then(setMaximized)
    return window.dr.window.onMaximizeChange(setMaximized)
  }, [platform])

  if (platform === 'darwin') return null

  return (
    <div className="window-controls">
      <button className="wc-btn" title="Minimize" onClick={() => window.dr.window.minimize()}>
        <IconWinMinimize />
      </button>
      <button className="wc-btn" title={maximized ? 'Restore' : 'Maximize'} onClick={() => window.dr.window.toggleMaximize()}>
        {maximized ? <IconWinRestore /> : <IconWinMaximize />}
      </button>
      <button className="wc-btn wc-close" title="Close" onClick={() => window.dr.window.close()}>
        <IconWinClose />
      </button>
    </div>
  )
}

// ── StatusBar ─────────────────────────────────────────────────────────────────
type LichStatus = 'stopped' | 'starting' | 'ready' | 'error'

export function StatusBar({
  status, charName, onDisconnect, onStartLich, lichStatus, lichLog,
  showLichLog, onToggleLichLog, onSettings, onHighlights
}: {
  status:          ConnectionStatus
  charName:        string
  onDisconnect:    () => void
  onStartLich:     () => void
  lichStatus:      LichStatus
  lichLog:         string[]
  showLichLog:     boolean
  onToggleLichLog: () => void
  onSettings:      () => void
  onHighlights:    () => void
}) {
  return (
    <div className="status-bar">
      <img src="/icon.svg" className="app-icon" alt="" aria-hidden />
      <span className="app-title">Meridian</span>
      <span className={`connection-status status-${status}`}>{status}</span>

      {status === 'connected' && (
        <span className="lich-status-indicator">
          <span className={`lich-status-dot lich-status-dot-${lichStatus}`} />
          {lichStatus === 'stopped' || lichStatus === 'error'
            ? <button className="btn-connect" onClick={onStartLich}>
                {lichStatus === 'error' ? 'Retry Lich' : 'Start Lich'}
              </button>
            : <span className="lich-status-label">
                {lichStatus === 'starting' ? 'Lich starting…' : 'Lich active'}
              </span>
          }
          <button
            className="lich-log-toggle-btn"
            onClick={onToggleLichLog}
            title={showLichLog ? 'Hide log' : `Show log (${lichLog.length} lines)`}
          >
            <IconChevron size={11} open={showLichLog} />
            <span>log</span>
            {lichLog.length > 0 && <span className="lich-log-count">{lichLog.length}</span>}
          </button>
        </span>
      )}

      {status !== 'connected' && lichLog.length > 0 && (
        <button className="lich-log-toggle-btn" onClick={onToggleLichLog}>
          <IconChevron size={11} open={showLichLog} />
          <span>log</span>
          <span className="lich-log-count">{lichLog.length}</span>
        </button>
      )}

      {status === 'connected' && <HandDisplay />}
      <div className="status-bar-spacer" />
      {status === 'connected' && (
        <>
          {charName && <span className="status-char-name">{charName}</span>}
          <button className="btn-connect" onClick={onDisconnect}>Disconnect</button>
        </>
      )}
      <button className="btn-settings" onClick={onHighlights} title="Highlights">
        <IconSparkles size={14} />Highlights
      </button>
      <button className="btn-settings" onClick={onSettings} title="Settings">
        <IconCog size={14} />Settings
      </button>
      <WindowControls />
    </div>
  )
}

// Keep these for potential use
export function VitalsBar() { return null }
export function RoomPanel() { return null }
