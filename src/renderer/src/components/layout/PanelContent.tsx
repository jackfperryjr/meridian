import { useAtomValue } from 'jotai'
import {
  vitalsAtom,
  roomAtom,
  activeSpellAtom,
  roundtimeSecondsAtom,
  indicatorsAtom,
  outputLinesAtom,
  inventoryLinesAtom,
  type OutputLine
} from '../../store/game'

// ── Room Panel ────────────────────────────────────────────────────────────────
export function RoomPanel() {
  const room = useAtomValue(roomAtom)
  return (
    <div className="panel-content room-panel-content">
      <div className="room-name">{room.name || '—'}</div>
      {room.description
        ? <div className="room-desc">{room.description}</div>
        : <div className="panel-empty">No description</div>
      }
    </div>
  )
}

// ── Vitals Panel ──────────────────────────────────────────────────────────────
function VitalBar({ label, value, max, cls }: {
  label: string; value: number; max: number; cls: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="vital-row">
      <span className="vital-label">{label}</span>
      <div className="vital-track">
        <div className={`vital-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="vital-value">{pct}%</span>
    </div>
  )
}

export function VitalsPanel() {
  const vitals     = useAtomValue(vitalsAtom)
  const rt         = useAtomValue(roundtimeSecondsAtom)
  const indicators = useAtomValue(indicatorsAtom)
  const active     = Object.entries(indicators).filter(([, v]) => v)

  return (
    <div className="panel-content">
      <VitalBar label="HP"  {...vitals.health}      cls="vital-health"  />
      <VitalBar label="MP"  {...vitals.mana}        cls="vital-mana"    />
      <VitalBar label="SP"  {...vitals.stamina}      cls="vital-stamina" />
      <VitalBar label="ST"  {...vitals.spirit}       cls="vital-spirit"  />
      <VitalBar label="ENC" {...vitals.encumbrance} cls="vital-enc"     />
      {rt > 0 && (
        <div className="roundtime-badge" style={{ marginTop: 6 }}>RT: {rt}s</div>
      )}
      {active.length > 0 && (
        <div className="indicators" style={{ marginTop: 4 }}>
          {active.map(([id]) => (
            <span key={id} className="indicator-badge">{id}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Active Spells Panel ───────────────────────────────────────────────────────
export function SpellsPanel() {
  const spell = useAtomValue(activeSpellAtom)
  return (
    <div className="panel-content">
      {spell
        ? <div className="active-spell-row">{spell}</div>
        : <div className="panel-empty">No active spell</div>
      }
    </div>
  )
}

// ── Experience Panel ──────────────────────────────────────────────────────────
export function ExperiencePanel() {
  const lines = useAtomValue(outputLinesAtom)
  const expLines = lines
    .filter(l => /experience|mindstate|absorbed|field exp/i.test(l.text))
    .slice(-12)

  return (
    <div className="panel-content panel-content-scroll">
      {expLines.length === 0
        ? <div className="panel-empty">No experience data yet — type EXP</div>
        : expLines.map((l: OutputLine) => (
            <div key={l.id} className="exp-line">{l.text.trim()}</div>
          ))
      }
    </div>
  )
}

// ── Conversation Panel ────────────────────────────────────────────────────────
export function ConversationPanel() {
  const lines = useAtomValue(outputLinesAtom)
  const convLines = lines.filter(l =>
    l.styles.some(s =>
      s.preset === 'speech' || s.preset === 'whisper' ||
      s.preset === 'thought' || s.preset === 'shout'
    )
  ).slice(-60)

  return (
    <div className="panel-content panel-content-scroll">
      {convLines.length === 0
        ? <div className="panel-empty">No conversation yet</div>
        : convLines.map((l: OutputLine) => (
            <div key={l.id} className="conv-line"
              style={{ color: convColor(l.styles[0]?.preset) }}>
              {l.text.trim()}
            </div>
          ))
      }
    </div>
  )
}

function convColor(preset?: string): string {
  switch (preset) {
    case 'speech':  return 'var(--color-speech)'
    case 'whisper': return 'var(--color-whisper)'
    case 'thought': return 'var(--color-thought)'
    default:        return 'var(--text-main)'
  }
}

// ── Inventory Panel ───────────────────────────────────────────────────────────
export function InventoryPanel() {
  const lines = useAtomValue(inventoryLinesAtom)
  return (
    <div className="panel-content panel-content-scroll">
      {lines.length === 0
        ? <div className="panel-empty">Type INV to see inventory</div>
        : lines.map((line, i) => (
            <div key={i} className="inv-line">{line}</div>
          ))
      }
    </div>
  )
}
