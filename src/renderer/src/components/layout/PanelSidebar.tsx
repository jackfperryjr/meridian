import { useState, useRef, useCallback, useEffect } from 'react'

export type PanelId = 'room' | 'vitals' | 'experience' | 'spells' | 'conversation' | 'inventory' | 'combat' | 'atmo'

export interface PanelConfig {
  id:      PanelId
  label:   string
  visible: boolean
}

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'room',         label: 'Room',          visible: true  },
  { id: 'vitals',       label: 'Vitals',        visible: true  },
  { id: 'experience',   label: 'Experience',    visible: true  },
  { id: 'spells',       label: 'Active Spells', visible: true  },
  { id: 'combat',       label: 'Combat',        visible: false },
  { id: 'atmo',         label: 'Atmosphere',    visible: false },
  { id: 'conversation', label: 'Conversation',  visible: false },
  { id: 'inventory',    label: 'Inventory',     visible: false },
]

const STORAGE_KEY = 'meridian-panels-v3'

function loadPanels(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PanelConfig[]
  } catch {}
  return DEFAULT_PANELS
}

function savePanels(panels: PanelConfig[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(panels)) } catch {}
}

// ── Single panel ───────────────────────────────────────────────────────────────
function Panel({
  config, children, onToggle
}: {
  config: PanelConfig; children: React.ReactNode; onToggle: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [height, setHeight]       = useState<number | null>(null)
  const bodyRef   = useRef<HTMLDivElement>(null)
  const dragging  = useRef(false)
  const startY    = useRef(0)
  const startH    = useRef(0)

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current   = e.clientY
    startH.current   = bodyRef.current?.clientHeight ?? 120
    document.body.style.cursor    = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newH = Math.max(48, startH.current + (e.clientY - startY.current))
      setHeight(newH)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  return (
    <div className="panel-card">
      <div className="panel-header" onDoubleClick={() => setCollapsed(c => !c)}>
        <span className="panel-title">{config.label}</span>
        <div className="panel-header-actions">
          <button className="panel-collapse-btn" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '▸' : '▾'}
          </button>
          <button className="panel-collapse-btn" onClick={onToggle} style={{ opacity: 0.5 }} title="Hide">×</button>
        </div>
      </div>
      {!collapsed && (
        <>
          <div
            ref={bodyRef}
            className="panel-content panel-content-scroll"
            style={height !== null ? { height, overflow: 'auto' } : {}}
          >
            {children}
          </div>
          <div className="panel-resize-handle" onMouseDown={onResizeStart} title="Drag to resize" />
        </>
      )}
    </div>
  )
}

// ── Panel manager popup ────────────────────────────────────────────────────────
function PanelManager({
  panels, onToggle, onClose, anchorRef
}: {
  panels: PanelConfig[]; onToggle: (id: PanelId) => void
  onClose: () => void; anchorRef: React.RefObject<HTMLButtonElement>
}) {
  const [pos, setPos] = useState({ top: 0, right: 0 })
  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }, [anchorRef])

  return (
    <>
      <div className="panel-manager-backdrop" onClick={onClose} />
      <div className="panel-manager-popup" style={{ top: pos.top, right: pos.right, position: 'fixed' }}>
        <div className="panel-manager-title">Panels</div>
        {panels.map(p => (
          <label key={p.id} className="panel-manager-item">
            <input type="checkbox" checked={p.visible} onChange={() => onToggle(p.id)} />
            {p.label}
          </label>
        ))}
      </div>
    </>
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────────
export function PanelSidebar({ renderPanel, sidebarWidth }: {
  renderPanel: (id: PanelId) => React.ReactNode
  sidebarWidth?: number | null
}) {
  const [panels,      setPanels]      = useState<PanelConfig[]>(loadPanels)
  const [showManager, setShowManager] = useState(false)
  const managerBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { savePanels(panels) }, [panels])

  const togglePanel = useCallback((id: PanelId) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p))
  }, [])

  return (
    <aside className="panel-sidebar" style={sidebarWidth ? { width: sidebarWidth, flex: "none" } : {}}>
      <div className="panel-sidebar-header">
        <button ref={managerBtnRef} className="panel-manager-toggle" onClick={() => setShowManager(v => !v)}>
          ⊞ Panels
        </button>
      </div>
      <div className="panel-sidebar-scroll">
        {panels.filter(p => p.visible).map(panel => (
          <Panel key={panel.id} config={panel} onToggle={() => togglePanel(panel.id)}>
            {renderPanel(panel.id)}
          </Panel>
        ))}
        {panels.filter(p => p.visible).length === 0 && (
          <div className="panel-sidebar-empty">No panels — click ⊞ Panels to add some.</div>
        )}
      </div>
      {showManager && (
        <PanelManager
          panels={panels} onToggle={togglePanel}
          onClose={() => setShowManager(false)} anchorRef={managerBtnRef}
        />
      )}
    </aside>
  )
}
