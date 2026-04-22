import { useState, useEffect, useRef } from 'react'
import { Provider, useSetAtom } from 'jotai'
import { useGameConnection }  from './hooks/useGameConnection'
import { GameOutput, setHighlights } from './components/game/GameOutput'
import { CommandInput, StatusBar } from './components/game'
import { LoginFlow }          from './components/ui/LoginFlow'
import { SettingsModal }      from './components/ui/SettingsModal'
import { HighlightsModal }    from './components/ui/HighlightsModal'
import { PanelSidebar }       from './components/layout/PanelSidebar'
import type { PanelId }       from './components/layout/PanelSidebar'
import {
  RoomPanel, VitalsPanel, SpellsPanel,
  ExperiencePanel, ConversationPanel, InventoryPanel,
} from './components/layout/PanelContent'
import { echoCommandAtom }    from './store/game'
import { applyTheme, DEFAULT_HIGHLIGHTS } from './lib/themes'
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

function GameLayout() {
  const { status, disconnect, send } = useGameConnection()
  const echoCommand  = useSetAtom(echoCommandAtom)
  const [lichStatus, setLichStatus]   = useState<'stopped'|'starting'|'ready'|'error'>('stopped')
  const [lichLog,    setLichLog]      = useState<string[]>([])
  const [showLog,    setShowLog]      = useState(false)
  const [showSettings,   setShowSettings]   = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)

  useEffect(() => {
    window.dr.settings.getAll().then(s => {
      const settings = s as Record<string, unknown>
      if (settings.fontSize)   document.documentElement.style.setProperty('--font-size-game', `${settings.fontSize}px`)
      if (settings.fontFamily) document.documentElement.style.setProperty('--font-game', `'${settings.fontFamily}', monospace`)
      if (settings.theme)      applyTheme(settings.theme as string)
      // Seed default highlights on first run
      const hls = (settings.highlights as never[] | undefined)
      if (hls && hls.length > 0) {
        setHighlights(hls)
      } else {
        setHighlights(DEFAULT_HIGHLIGHTS as never[])
        window.dr.settings.patch({ highlights: DEFAULT_HIGHLIGHTS } as Record<string, unknown>)
      }
    })
    window.dr.lich.getLog().then(lines => { if (lines.length > 0) setLichLog(lines) })
    window.dr.lich.detectPath().then(() => {})
  }, [])

  useEffect(() => {
    const unsubs = [
      window.dr.lich.onStatus((s: string) => setLichStatus(s as 'stopped'|'starting'|'ready'|'error')),
      window.dr.lich.onError(() => { setLichStatus('error'); setShowLog(true) }),
      window.dr.lich.onLog((line: string) => setLichLog(prev => [...prev.slice(-199), line.trimEnd()]))
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  // Reload highlights when highlights modal closes
  const handleHighlightsClose = () => {
    setShowHighlights(false)
    window.dr.settings.getAll().then(s => {
      const settings = s as Record<string, unknown>
      if (settings.highlights) setHighlights(settings.highlights as never[])
    })
  }

  const handleStartLich = async () => {
    const s = await window.dr.settings.getAll()
    const settings = s as Record<string, unknown>
    if (!settings.lichPath) { setShowSettings(true); return }
    const accounts = (settings.accounts ?? []) as { name: string; lastCharacter?: string }[]
    const lastChar = accounts.find(a => a.name === settings.lastAccount)?.lastCharacter
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
        onHighlights={() => setShowHighlights(true)}
      />
      {showLog && <LichLogDrawer lines={lichLog} onClose={() => setShowLog(false)} />}
      <div className="main-area">
        <div className="game-col">
          <main className="game-output-wrap">
            <GameOutput />
          </main>
          <footer className="bottom-bar">
            <CommandInput onSend={send} onEcho={echoCommand} />
          </footer>
        </div>
        <PanelSidebar renderPanel={renderPanel} />
      </div>
      {showSettings   && <SettingsModal    onClose={() => setShowSettings(false)} />}
      {showHighlights && <HighlightsModal  onClose={handleHighlightsClose} />}
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
