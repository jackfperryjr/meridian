import { atom } from 'jotai'
import type { GameEvent, VitalField } from '../lib/sge-parser'

// ── Connection ──────────────────────────────────────────────────────────────
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export const connectionStatusAtom = atom<ConnectionStatus>('disconnected')

// ── Game output lines ───────────────────────────────────────────────────────
export interface OutputLine {
  id:        number
  text:      string
  styles:    GameEvent extends { type: 'text' } ? GameEvent['styles'] : never
  timestamp: number
}

let lineId = 0
export const outputLinesAtom = atom<OutputLine[]>([])

// ── Vitals ──────────────────────────────────────────────────────────────────
export interface VitalState { value: number; max: number }

export const vitalsAtom = atom<Record<VitalField, VitalState>>({
  health:      { value: 100, max: 100 },
  mana:        { value: 100, max: 100 },
  stamina:     { value: 100, max: 100 },
  spirit:      { value: 100, max: 100 },
  encumbrance: { value: 0,   max: 100 }
})

// ── Room ────────────────────────────────────────────────────────────────────
export interface RoomState {
  name:        string
  description: string
  exits:       string[]
}

export const roomAtom = atom<RoomState>({ name: '', description: '', exits: [] })

// ── Inventory lines ─────────────────────────────────────────────────────────
export const inventoryLinesAtom = atom<string[]>([])

// ── Indicators ──────────────────────────────────────────────────────────────
export const indicatorsAtom = atom<Record<string, boolean>>({})

// ── Active spell ─────────────────────────────────────────────────────────────
export const activeSpellAtom = atom<string>('')

// ── Timers ───────────────────────────────────────────────────────────────────
export const roundtimeAtom     = atom<number>(0)
export const castTimeAtom      = atom<number>(0)
export const roundtimeSecondsAtom = atom((get) =>
  Math.max(0, Math.ceil((get(roundtimeAtom) - Date.now()) / 1000))
)


// ── Echo: commands sent by the player ────────────────────────────────────────
export const echoCommandAtom = atom(
  null,
  (get, set, command: string) => {
    const preset = command.startsWith(';') ? 'echo-script' : 'echo'
    const lines = get(outputLinesAtom)
    set(outputLinesAtom, [...lines.slice(-4999), {
      id: lineId++,
      text: command,
      styles: [{ preset }],
      timestamp: Date.now()
    }])
  }
)

// ── Dispatch ─────────────────────────────────────────────────────────────────
export const dispatchGameEventAtom = atom(
  null,
  (get, set, event: GameEvent) => {
    switch (event.type) {

      case 'text': {
        const next: OutputLine = {
          id: lineId++, text: event.text,
          styles: event.styles, timestamp: Date.now()
        }
        set(outputLinesAtom, [...get(outputLinesAtom).slice(-4999), next])
        break
      }

      case 'roomName': {
        const r = get(roomAtom)
        set(roomAtom, { ...r, name: event.name })
        break
      }

      case 'roomDesc': {
        const r = get(roomAtom)
        set(roomAtom, { ...r, description: event.description })
        break
      }

      case 'room':
        set(roomAtom, { name: event.name, description: event.description, exits: event.exits })
        break

      case 'vitals': {
        set(vitalsAtom, {
          ...get(vitalsAtom),
          [event.field]: { value: event.value, max: event.max }
        })
        break
      }

      case 'inv': {
        const lines = get(inventoryLinesAtom)
        // Clear and restart on a bare "You are carrying:" style header
        if (/you are carrying/i.test(event.text)) {
          set(inventoryLinesAtom, [event.text])
        } else {
          set(inventoryLinesAtom, [...lines.slice(-199), event.text])
        }
        break
      }

      case 'indicator': {
        set(indicatorsAtom, { ...get(indicatorsAtom), [event.id]: event.active })
        break
      }

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
