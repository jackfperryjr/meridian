import { useState, useRef, useCallback, useEffect } from 'react'

export type PanelId =
  | 'room'
  | 'vitals'
  | 'experience'
  | 'spells'
  | 'conversation'
  | 'inventory'

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
  { id: 'conversation', label: 'Conversation',  visible: false },
  { id: 'inventory',    label: 'Inventory',     visible: false },
]

const STORAGE_KEY = 'meridian-panels-v2'

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

// ── Single panel card ──────────────────────────────────────────────────────────
function Panel({
  config,
  children,
  onToggle,
}: {
  config:   PanelConfig
  children: React.ReactNode
  onToggle: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="panel-card">
      <div className="panel-header" onDoubleClick={() => setCollapsed(c => !c)}>
        <span className="panel-title">{config.label}</span>
        <div className="panel-header-actions">
          <button
            className="panel-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          <button
            className="panel-collapse-btn"
            onClick={onToggle}
            title="Hide panel"
            style={{ opacity: 0.6 }}
          >
            ×
          </button>
        </div>
      </div>
      {!collapsed && <div className="panel-content">{children}</div>}
    </div>
  )
}

// ── Panel manager popup ────────────────────────────────────────────────────────
function PanelManager({
  panels,
  onToggle,
  onClose,
  anchorRef,
}: {
  panels:    PanelConfig[]
  onToggle:  (id: PanelId) => void
  onClose:   () => void
  anchorRef: React.RefObject<HTMLButtonElement>
}) {
  // Position below the anchor button
  const [top, setTop] = useState(0)
  const [right, setRight] = useState(0)
  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTop(r.bottom + 4)
    setRight(window.innerWidth - r.right)
  }, [anchorRef])

  return (
    <>
      <div className="panel-manager-backdrop" onClick={onClose} />
      <div className="panel-manager-popup" style={{ top, right, position: 'fixed' }}>
        <div className="panel-manager-title">Panels</div>
        {panels.map(p => (
          <label key={p.id} className="panel-manager-item">
            <input
              type="checkbox"
              checked={p.visible}
              onChange={() => onToggle(p.id)}
            />
            {p.label}
          </label>
        ))}
      </div>
    </>
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────────
export function PanelSidebar({ renderPanel }: {
  renderPanel: (id: PanelId) => React.ReactNode
}) {
  const [panels,      setPanels]      = useState<PanelConfig[]>(loadPanels)
  const [showManager, setShowManager] = useState(false)
  const managerBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { savePanels(panels) }, [panels])

  const togglePanel = useCallback((id: PanelId) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p))
  }, [])

  const visiblePanels = panels.filter(p => p.visible)

  return (
    <aside className="panel-sidebar">
      {/* Sticky header with panel manager button */}
      <div className="panel-sidebar-header">
        <button
          ref={managerBtnRef}
          className="panel-manager-toggle"
          onClick={() => setShowManager(v => !v)}
        >
          ⊞ Panels
        </button>
      </div>

      {/* Scrollable panel stack */}
      <div className="panel-sidebar-scroll">
        {visiblePanels.map(panel => (
          <Panel
            key={panel.id}
            config={panel}
            onToggle={() => togglePanel(panel.id)}
          >
            {renderPanel(panel.id)}
          </Panel>
        ))}
        {visiblePanels.length === 0 && (
          <div className="panel-sidebar-empty">
            No panels visible.<br />Click ⊞ Panels to add some.
          </div>
        )}
      </div>

      {showManager && (
        <PanelManager
          panels={panels}
          onToggle={togglePanel}
          onClose={() => setShowManager(false)}
          anchorRef={managerBtnRef}
        />
      )}
    </aside>
  )
}
