import { useState, useEffect, useRef } from 'react'
import { Provider, useSetAtom } from 'jotai'
import { useGameConnection }  from './hooks/useGameConnection'
import { GameOutput }         from './components/game/GameOutput'
import { CommandInput, StatusBar } from './components/game'
import { LoginFlow }          from './components/ui/LoginFlow'
import { SettingsModal }      from './components/ui/SettingsModal'
import { PanelSidebar }       from './components/layout/PanelSidebar'
import type { PanelId }       from './components/layout/PanelSidebar'
import {
  RoomPanel, VitalsPanel, SpellsPanel,
  ExperiencePanel, ConversationPanel, InventoryPanel,
} from './components/layout/PanelContent'
import { echoCommandAtom } from './store/game'
import './styles/global.css'

function renderPanel(id: PanelId) {
  switch (id) {
    case 'room':         return <RoomPanel />
    case 'vitals':       return <VitalsPanel />
    case 'spells':       return <SpellsPanel />
    case 'experience':   return <ExperiencePanel />
    case 'conversation': return <ConversationPanel />
    case 'inventory':    return <InventoryPanel />
    default:             return null
  }
}

// ── Lich log drawer ───────────────────────────────────────────────────────────
function LichLogDrawer({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="lich-drawer">
      <div className="lich-drawer-header">
        <span>Lich Log</span>
        <button className="lich-drawer-close" onClick={onClose}>✕</button>
      </div>
      <div className="lich-drawer-body">
        {lines.map((l, i) => (
          <div key={i} className={`lich-log-line ${l.startsWith('[error]') ? 'lich-log-error' : ''}`}>
            {l}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Game layout ───────────────────────────────────────────────────────────────
function GameLayout() {
  const { status, disconnect, send } = useGameConnection()
  const echoCommand  = useSetAtom(echoCommandAtom)
  const [lichStatus, setLichStatus]   = useState<'stopped'|'starting'|'ready'|'error'>('stopped')
  const [lichLog,    setLichLog]      = useState<string[]>([])
  const [showLog,    setShowLog]      = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Load persisted log history + apply font settings on mount
  useEffect(() => {
    window.dr.settings.getAll().then(s => {
      if (s.fontSize)   document.documentElement.style.setProperty('--font-size-game', `${s.fontSize}px`)
      if (s.fontFamily) document.documentElement.style.setProperty('--font-game', `'${s.fontFamily}', monospace`)
    })
    // Load any log lines that fired before this component mounted
    window.dr.lich.getLog().then(lines => {
      if (lines.length > 0) setLichLog(lines)
    })
    window.dr.lich.detectPath().then(() => {})
  }, [])

  useEffect(() => {
    const unsubs = [
      window.dr.lich.onStatus((s: string) => {
        setLichStatus(s as 'stopped'|'starting'|'ready'|'error')
      }),
      window.dr.lich.onError(() => {
        setLichStatus('error')
        setShowLog(true) // auto-open on error
      }),
      window.dr.lich.onLog((line: string) => {
        setLichLog(prev => [...prev.slice(-199), line.trimEnd()])
      })
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  const handleStartLich = async () => {
    const s = await window.dr.settings.getAll()
    if (!s.lichPath) { setShowSettings(true); return }
    const lastChar = s.accounts?.find(a => a.name === s.lastAccount)?.lastCharacter
    if (!lastChar) { alert('Could not determine character name.'); return }
    setLichLog([])
    window.dr.lich.launchSidecar(lastChar)
  }

  return (
    <div className="app-shell">
      <StatusBar
        status={status}
        onDisconnect={disconnect}
        onStartLich={handleStartLich}
        lichStatus={lichStatus}
        lichLog={lichLog}
        showLichLog={showLog}
        onToggleLichLog={() => setShowLog(v => !v)}
        onSettings={() => setShowSettings(true)}
      />
      {showLog && (
        <LichLogDrawer lines={lichLog} onClose={() => setShowLog(false)} />
      )}
      <div className="main-area">
        <PanelSidebar renderPanel={renderPanel} />
        <main className="game-output-wrap">
          <GameOutput />
        </main>
      </div>
      <footer className="bottom-bar">
        <CommandInput onSend={send} onEcho={echoCommand} />
      </footer>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function AppInner() {
  const [inGame, setInGame] = useState(false)
  if (!inGame) return <LoginFlow onEnterGame={() => setInGame(true)} />
  return <GameLayout />
}

export default function App() {
  return <Provider><AppInner /></Provider>
}
