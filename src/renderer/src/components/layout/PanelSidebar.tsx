import { useState, useRef, useCallback, useEffect } from 'react'

// ── Panel registry ────────────────────────────────────────────────────────────
export type PanelId =
  | 'room'
  | 'vitals'
  | 'experience'
  | 'spells'
  | 'conversation'
  | 'inventory'
  | 'output'

export interface PanelConfig {
  id:      PanelId
  label:   string
  visible: boolean
  // For sidebar panels: height as a fraction of sidebar height (0–1)
  // For output: fills remaining space
  size:    number
}

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'room',         label: 'Room',         visible: true,  size: 0.30 },
  { id: 'vitals',       label: 'Vitals',       visible: true,  size: 0.18 },
  { id: 'experience',   label: 'Experience',   visible: true,  size: 0.20 },
  { id: 'spells',       label: 'Active Spells',visible: true,  size: 0.15 },
  { id: 'conversation', label: 'Conversation', visible: false, size: 0.17 },
  { id: 'inventory',    label: 'Inventory',    visible: false, size: 0.17 },
]

const STORAGE_KEY = 'meridian-panels-v1'

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

// ── Drag resize handle ─────────────────────────────────────────────────────────
function DragHandle({ onDrag }: { onDrag: (dy: number) => void }) {
  const dragging = useRef(false)
  const lastY    = useRef(0)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastY.current = e.clientY
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      onDrag(e.clientY - lastY.current)
      lastY.current = e.clientY
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onDrag])

  return <div className="drag-handle" onMouseDown={onMouseDown} />
}

// ── Panel wrapper ──────────────────────────────────────────────────────────────
function Panel({
  config,
  height,
  children,
  onDrag,
  onToggle,
  isLast
}: {
  config:   PanelConfig
  height:   number
  children: React.ReactNode
  onDrag:   (dy: number) => void
  onToggle: () => void
  isLast:   boolean
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={`panel ${collapsed ? 'panel-collapsed' : ''}`}
      style={{ height: collapsed ? 26 : height, minHeight: collapsed ? 26 : 60 }}
    >
      <div className="panel-header" onDoubleClick={() => setCollapsed(c => !c)}>
        <span className="panel-title">{config.label}</span>
        <div className="panel-header-actions">
          <button className="panel-btn" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '▸' : '▾'}
          </button>
          <button className="panel-btn panel-btn-close" onClick={onToggle} title="Hide panel">×</button>
        </div>
      </div>
      {!collapsed && (
        <div className="panel-body">{children}</div>
      )}
      {!collapsed && !isLast && <DragHandle onDrag={onDrag} />}
    </div>
  )
}

// ── Panel manager / settings overlay ──────────────────────────────────────────
function PanelManager({
  panels,
  onToggle,
  onClose
}: {
  panels:   PanelConfig[]
  onToggle: (id: PanelId) => void
  onClose:  () => void
}) {
  return (
    <div className="panel-manager-overlay" onClick={onClose}>
      <div className="panel-manager" onClick={e => e.stopPropagation()}>
        <div className="panel-manager-title">Panels</div>
        {panels.map(p => (
          <label key={p.id} className="panel-manager-row">
            <input
              type="checkbox"
              checked={p.visible}
              onChange={() => onToggle(p.id)}
            />
            {p.label}
          </label>
        ))}
        <button className="login-btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

// ── Main sidebar layout ────────────────────────────────────────────────────────
export function PanelSidebar({
  renderPanel
}: {
  renderPanel: (id: PanelId) => React.ReactNode
}) {
  const [panels,      setPanels]      = useState<PanelConfig[]>(loadPanels)
  const [showManager, setShowManager] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Persist on change
  useEffect(() => { savePanels(panels) }, [panels])

  const visiblePanels = panels.filter(p => p.visible)

  const handleDrag = useCallback((index: number, dy: number) => {
    const containerH = containerRef.current?.clientHeight ?? 600
    setPanels(prev => {
      const vis    = prev.filter(p => p.visible)
      const total  = vis.reduce((a, p) => a + p.size, 0)
      const delta  = dy / containerH

      if (index >= vis.length - 1) return prev
      const a = vis[index]
      const b = vis[index + 1]
      const minSize = 60 / containerH

      const newA = Math.max(minSize, a.size + delta)
      const newB = Math.max(minSize, b.size - delta)
      if (newA + newB > a.size + b.size + 0.001) return prev

      return prev.map(p => {
        if (p.id === a.id) return { ...p, size: newA }
        if (p.id === b.id) return { ...p, size: newB }
        return p
      })
    })
  }, [])

  const togglePanel = useCallback((id: PanelId) => {
    setPanels(prev => prev.map(p =>
      p.id === id ? { ...p, visible: !p.visible } : p
    ))
  }, [])

  return (
    <div className="panel-sidebar" ref={containerRef}>
      <div className="panel-sidebar-header">
        <button
          className="panel-sidebar-manage"
          onClick={() => setShowManager(true)}
          title="Manage panels"
        >
          ⊞ Panels
        </button>
      </div>

      <div className="panel-sidebar-body">
        {visiblePanels.map((panel, i) => {
          const containerH = containerRef.current?.clientHeight ?? 600
          const bodyH      = containerH - 28 // subtract header
          const height     = Math.round(panel.size * bodyH)

          return (
            <Panel
              key={panel.id}
              config={panel}
              height={height}
              onDrag={(dy) => handleDrag(i, dy)}
              onToggle={() => togglePanel(panel.id)}
              isLast={i === visiblePanels.length - 1}
            >
              {renderPanel(panel.id)}
            </Panel>
          )
        })}
      </div>

      {showManager && (
        <PanelManager
          panels={panels}
          onToggle={togglePanel}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  )
}
