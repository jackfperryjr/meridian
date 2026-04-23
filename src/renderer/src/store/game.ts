import { atom } from 'jotai'
import type { GameEvent, VitalField, StreamId } from '../lib/sge-parser'

export type { StreamId }

// ── Connection ────────────────────────────────────────────────────────────────
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export const connectionStatusAtom = atom<ConnectionStatus>('disconnected')

// ── Output lines ──────────────────────────────────────────────────────────────
export interface OutputLine {
  id:        number
  text:      string
  styles:    GameEvent extends { type: 'text' } ? GameEvent['styles'] : never
  stream:    StreamId
  timestamp: number
}

let lineId = 0
const mkLine = (text: string, styles: OutputLine['styles'], stream: StreamId): OutputLine => ({
  id: lineId++, text, styles, stream, timestamp: Date.now()
})

// Main game output (stream = 'main' + echoes)
export const outputLinesAtom  = atom<OutputLine[]>([])

// Stream-specific lines
export const expLinesAtom     = atom<OutputLine[]>([])
export const combatLinesAtom  = atom<OutputLine[]>([])
export const atmoLinesAtom    = atom<OutputLine[]>([])
export const convLinesAtom    = atom<OutputLine[]>([])
export const lichMsgAtom      = atom<string[]>([])

// ── Vitals ────────────────────────────────────────────────────────────────────
export interface VitalState { value: number; max: number }

export const vitalsAtom = atom<Record<VitalField, VitalState>>({
  health:      { value: 100, max: 100 },
  mana:        { value: 100, max: 100 },
  stamina:     { value: 100, max: 100 },
  spirit:      { value: 100, max: 100 },
  encumbrance: { value: 0,   max: 100 }
})

// ── Room ──────────────────────────────────────────────────────────────────────
export interface RoomState { name: string; description: string; exits: string[] }
export const roomAtom = atom<RoomState>({ name: '', description: '', exits: [] })

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryLinesAtom = atom<string[]>([])

// ── Hands ────────────────────────────────────────────────────────────────────
export const handsAtom = atom<{ left: string; right: string }>({ left: '', right: '' })

// ── Indicators ────────────────────────────────────────────────────────────────
export const indicatorsAtom = atom<Record<string, boolean>>({})

// ── Active spell ──────────────────────────────────────────────────────────────
export const activeSpellAtom = atom<string>('')

// ── Timers ────────────────────────────────────────────────────────────────────
export const roundtimeAtom        = atom<number>(0)
export const castTimeAtom         = atom<number>(0)
export const roundtimeSecondsAtom = atom(get =>
  Math.max(0, Math.ceil((get(roundtimeAtom) - Date.now()) / 1000))
)

// ── Experience ────────────────────────────────────────────────────────────────
export interface ExpSkill { name: string; rank: number; pct: number; mind: string }
export interface ExpState  { skills: ExpSkill[]; tdps: number; favors: number }
export const expAtom = atom<ExpState>({ skills: [], tdps: 0, favors: 0 })

// ── Echo ──────────────────────────────────────────────────────────────────────
export const echoCommandAtom = atom(
  null,
  (get, set, command: string) => {
    const preset = command.startsWith(';') ? 'echo-script' : 'echo'
    const line   = mkLine(command, [{ preset }], 'main')
    set(outputLinesAtom, [...get(outputLinesAtom).slice(-4999), line])
  }
)

// ── Dispatch ──────────────────────────────────────────────────────────────────
export const dispatchGameEventAtom = atom(
  null,
  (get, set, event: GameEvent) => {
    switch (event.type) {

      case 'text': {
        const line = mkLine(event.text, event.styles, event.stream)

        // Route to stream-specific atoms
        switch (event.stream) {
          case 'exp':
            // Exp text lines go to expLinesAtom; actual skill data comes via expSkill events
            set(expLinesAtom, [...get(expLinesAtom).slice(-499), line])
            break
          case 'inv': {
            const t = event.text
            if (t === '__clear_inv__') {
              set(inventoryLinesAtom, [])
            } else {
              set(inventoryLinesAtom, [...get(inventoryLinesAtom).slice(-299), t])
            }
            break
          }
          case 'lich':
            // Lich script output — append to lich log, don't show in game panel
            set(lichMsgAtom, [...get(lichMsgAtom).slice(-499), event.text])
            break
          case 'combat':
            set(combatLinesAtom, [...get(combatLinesAtom).slice(-499), line])
            set(outputLinesAtom, [...get(outputLinesAtom).slice(-4999), line])
            break
          case 'atmo':
            set(atmoLinesAtom, [...get(atmoLinesAtom).slice(-199), line])
            // Don't echo atmo to main output — it clutters it
            break
          case 'speech':
            set(convLinesAtom, [...get(convLinesAtom).slice(-199), line])
            set(outputLinesAtom, [...get(outputLinesAtom).slice(-4999), line])
            break
          default:
            set(outputLinesAtom, [...get(outputLinesAtom).slice(-4999), line])
        }
        // Route hand content
        if (event.styles.some(s => s.preset === 'left'))  set(handsAtom, { ...get(handsAtom), left:  event.text.trim() })
        if (event.styles.some(s => s.preset === 'right')) set(handsAtom, { ...get(handsAtom), right: event.text.trim() })
        // Also check for speech/whisper/thought styles and route to conv
        if (event.styles.some(s => ['speech','whisper','thought'].includes(s.preset ?? ''))) {
          set(convLinesAtom, [...get(convLinesAtom).slice(-199), line])
        }
        break
      }

      case 'roomName':
        set(roomAtom, { ...get(roomAtom), name: event.name })
        break

      case 'roomDesc':
        set(roomAtom, { ...get(roomAtom), description: event.description })
        break

      case 'roomExits':
        set(roomAtom, { ...get(roomAtom), exits: event.exits })
        break

      case 'expSkill': {
        const skill = { name: event.name, rank: event.rank, pct: event.pct, mind: event.mind }
        const exp   = get(expAtom)
        const idx   = exp.skills.findIndex(s => s.name === skill.name)
        const skills = idx >= 0
          ? exp.skills.map((s, i) => i === idx ? skill : s)
          : [...exp.skills, skill]
        set(expAtom, { ...exp, skills })
        break
      }

      case 'expMeta': {
        const exp = get(expAtom)
        set(expAtom, {
          ...exp,
          tdps:   event.tdps   ?? exp.tdps,
          favors: event.favors ?? exp.favors,
        })
        break
      }

      case 'vitals':
        set(vitalsAtom, { ...get(vitalsAtom), [event.field]: { value: event.value, max: event.max } })
        break

      case 'indicator':
        set(indicatorsAtom, { ...get(indicatorsAtom), [event.id]: event.active })
        break

      case 'spell':
        set(activeSpellAtom, event.name)
        break

      case 'roundtime':
        set(roundtimeAtom, event.expires)
        break

      case 'cast_time':
        set(castTimeAtom, event.expires)
        break
    }
  }
)
