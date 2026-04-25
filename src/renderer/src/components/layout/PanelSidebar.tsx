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

const PANELS_KEY  = 'meridian-panels-v3'
const HEIGHTS_KEY = 'meridian-panel-heights-v1'

function loadPanels(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(PANELS_KEY)
    if (raw) return JSON.parse(raw) as PanelConfig[]
  } catch {}
  return DEFAULT_PANELS
}

function savePanels(panels: PanelConfig[]) {
  try { localStorage.setItem(PANELS_KEY, JSON.stringify(panels)) } catch {}
}

function loadHeights(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HEIGHTS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch {}
  return {}
}

function saveHeights(heights: Record<string, number>) {
  try { localStorage.setItem(HEIGHTS_KEY, JSON.stringify(heights)) } catch {}
}

// ── Single panel ───────────────────────────────────────────────────────────────
function Panel({
  config, children, onToggle,
  height, onResizeBottom, onResizeTop,
}: {
  config:          PanelConfig
  children:        React.ReactNode
  onToggle:        () => void
  height:          number | null
  onResizeBottom:  (h: number) => void
  onResizeTop?:    (delta: number) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Use refs so the single shared event handler always sees fresh values
  const dragMode   = useRef<'top' | 'bottom' | null>(null)
  const startY     = useRef(0)
  const startH     = useRef(0)
  const onBottomCb = useRef(onResizeBottom)
  const onTopCb    = useRef(onResizeTop)
  useEffect(() => { onBottomCb.current = onResizeBottom }, [onResizeBottom])
  useEffect(() => { onTopCb.current    = onResizeTop    }, [onResizeTop])

  const beginDrag = (mode: 'top' | 'bottom', e: React.MouseEvent) => {
    e.preventDefault()
    dragMode.current = mode
    startY.current   = e.clientY
    startH.current   = bodyRef.current?.clientHeight ?? 120
    document.body.style.cursor     = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragMode.current) return
      if (dragMode.current === 'bottom') {
        const newH = Math.max(48, startH.current + (e.clientY - startY.current))
        onBottomCb.current(newH)
      } else {
        // top handle: incremental delta — positive delta = dragging down = prev panel grows
        const delta = e.clientY - startY.current
        startY.current = e.clientY
        onTopCb.current?.(delta)
      }
    }
    const onUp = () => {
      if (!dragMode.current) return
      dragMode.current = null
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  return (
    <div className="panel-card">
      {onResizeTop && (
        <div
          className="panel-resize-handle panel-resize-handle-top"
          onMouseDown={e => beginDrag('top', e)}
          title="Drag to resize"
        />
      )}
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
          <div
            className="panel-resize-handle"
            onMouseDown={e => beginDrag('bottom', e)}
            title="Drag to resize"
          />
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
  renderPanel:   (id: PanelId) => React.ReactNode
  sidebarWidth?: number | null
}) {
  const [panels,      setPanels]      = useState<PanelConfig[]>(loadPanels)
  const [heights,     setHeights]     = useState<Record<string, number>>(loadHeights)
  const [showManager, setShowManager] = useState(false)
  const managerBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { savePanels(panels)  }, [panels])
  useEffect(() => { saveHeights(heights) }, [heights])

  const togglePanel = useCallback((id: PanelId) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p))
  }, [])

  const setHeight = useCallback((id: string, h: number) => {
    setHeights(prev => ({ ...prev, [id]: h }))
  }, [])

  const visible = panels.filter(p => p.visible)

  return (
    <aside className="panel-sidebar" style={sidebarWidth ? { width: sidebarWidth, flex: 'none', maxWidth: 'none', minWidth: 0 } : {}}>
      <div className="panel-sidebar-header">
        <button ref={managerBtnRef} className="panel-manager-toggle" onClick={() => setShowManager(v => !v)}>
          ⊞ Panels
        </button>
      </div>
      <div className="panel-sidebar-scroll">
        {visible.map((panel, i) => (
          <Panel
            key={panel.id}
            config={panel}
            height={heights[panel.id] ?? null}
            onResizeBottom={h => setHeight(panel.id, h)}
            onResizeTop={i > 0 ? (delta) => {
              const prevId = visible[i - 1].id
              setHeights(prev => ({
                ...prev,
                [prevId]: Math.max(48, (prev[prevId] ?? 120) + delta)
              }))
            } : undefined}
            onToggle={() => togglePanel(panel.id)}
          >
            {renderPanel(panel.id)}
          </Panel>
        ))}
        {visible.length === 0 && (
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
