import { useState, useEffect, useRef, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { vitalsAtom, roomAtom, roundtimeSecondsAtom } from '../../store/game'
export type { ConnectionStatus } from '../../store/game'
import type { ConnectionStatus } from '../../store/game'

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

// ── StatusBar ────────────────────────────────────────────────────────────────
type LichStatus = 'stopped' | 'starting' | 'ready' | 'error'

export function StatusBar({
  status, onDisconnect, onStartLich, lichStatus, lichLog,
  showLichLog, onToggleLichLog, onSettings, onHighlights
}: {
  status:          ConnectionStatus
  onDisconnect:    () => void
  onStartLich:     () => void
  lichStatus:      LichStatus
  lichLog:         string[]
  showLichLog:     boolean
  onToggleLichLog: () => void
  onSettings:      () => void
  onHighlights:    () => void
}) {
  const lichDot: Record<LichStatus, string>   = { stopped: '○', starting: '◌', ready: '●', error: '✕' }
  const lichColor: Record<LichStatus, string> = {
    stopped: 'var(--text-dim)', starting: '#e0c070',
    ready: 'var(--color-bonus)', error: 'var(--color-warning)'
  }

  return (
    <div className="status-bar">
      <span className="app-title">Meridian</span>
      <span className={`connection-status status-${status}`}>{status}</span>

      {status === 'connected' && (
        <span className="lich-status-indicator" style={{ color: lichColor[lichStatus] }}>
          <span className="lich-dot">{lichDot[lichStatus]}</span>
          {lichStatus === 'stopped' || lichStatus === 'error'
            ? <button className="btn-connect" onClick={onStartLich}>
                {lichStatus === 'error' ? 'Retry Lich' : 'Start Lich'}
              </button>
            : <span style={{ fontSize: 11, marginLeft: 3 }}>
                {lichStatus === 'starting' ? 'Lich starting…' : 'Lich active'}
              </span>
          }
          <button
            className="lich-log-toggle-btn"
            onClick={onToggleLichLog}
            title={showLichLog ? 'Hide log' : `Show log (${lichLog.length} lines)`}
          >
            {showLichLog ? '▾ log' : '▸ log'}
            {lichLog.length > 0 && <span className="lich-log-count">{lichLog.length}</span>}
          </button>
        </span>
      )}

      {/* Show log button even when disconnected */}
      {status !== 'connected' && lichLog.length > 0 && (
        <button className="lich-log-toggle-btn" onClick={onToggleLichLog}>
          {showLichLog ? '▾ log' : '▸ log'}
          <span className="lich-log-count">{lichLog.length}</span>
        </button>
      )}

      <div className="status-bar-spacer" />
      {status === 'connected' && (
        <button className="btn-connect" onClick={onDisconnect}>Disconnect</button>
      )}
      <button className="btn-settings" onClick={onHighlights}>✦ Highlights</button>
      <button className="btn-settings" onClick={onSettings}>⚙ Settings</button>
    </div>
  )
}

// Keep these for potential use
export function VitalsBar() { return null }
export function RoomPanel() { return null }
