
export interface Highlight {
  id:      string
  pattern: string
  isRegex: boolean
  color:   string
  bgcolor: string
  bold:    boolean
  enabled: boolean
}

function hl(id: string, pattern: string, color: string, bgcolor = '', bold = false, isRegex = false): Highlight {
  return { id, pattern, isRegex, color, bgcolor, bold, enabled: true }
}

export const DEFAULT_HIGHLIGHTS: Highlight[] = [
  // Your character name — bright white on a dark highlight
  hl('char-name',    'Jackreous',             '#ffffff', '#2a1e3a', true),
  // Combat
  hl('death',        '\\bslain\\b|you die|killed\\b', '#ff4040', '#2a0808', true, true),
  hl('roundtime',    'Roundtime:',            '#e0c060', '', true),
  hl('stunned',      'stunned',               '#ff8040', '', true),
  hl('bleeding',     'bleeding',              '#cc3030', '', false),
  hl('webbed',       'webbed',                '#80c0e0', '', false),
  // Loot
  hl('coins',        'copper|silver|gold|platinum', '#e0c060', '', false, true),
  hl('gem',          '\\bgem\\b|\\bstone\\b|\\bcrystal\\b', '#80d8c0', '', false, true),
  // Social
  hl('speech-you',   'says,|say,|exclaims,|asks,', '#7ec8a0', '', false),
  hl('whisper',      'whispers',              '#a898d8', '', true),
  hl('thought',      'thinks,',               '#c890c8', '', true),
  // Danger
  hl('danger',       'critical|CRITICAL|shatters|broken', '#ff6040', '', true),
  // System
  hl('lich-active',  'Lich v',               '#7058c0', '', false),
  hl('exp-gained',   'You gain.*experience', '#60c878', '', false, true),
]
export interface Theme {
  id:    string
  name:  string
  vars:  Record<string, string>
}

export const THEMES: Theme[] = [
  {
    id: 'meridian',
    name: 'Meridian (default)',
    vars: {
      '--bg-shell':    '#111113',
      '--bg-panel':    '#1a1a1e',
      '--bg-input':    '#16161a',
      '--bg-sidebar':  '#141418',
      '--border':      '#2a2a32',
      '--border-soft': '#22222a',
      '--text-main':   '#d4d0c8',
      '--text-dim':    '#6a6870',
      '--text-bright': '#f0ece0',
      '--color-roomname':  '#b8d4f0',
      '--color-speech':    '#a8e890',
      '--color-whisper':   '#c0b8e8',
      '--color-thought':   '#d8c8a8',
      '--color-warning':   '#f0a060',
      '--color-bonus':     '#80d080',
      '--health-color':    '#e07070',
      '--mana-color':      '#7090e8',
      '--stamina-color':   '#78c870',
      '--spirit-color':    '#c878c8',
    }
  },
  {
    id: 'frostbite',
    name: 'Frostbite classic',
    vars: {
      '--bg-shell':    '#0d0d0d',
      '--bg-panel':    '#141414',
      '--bg-input':    '#0a0a0a',
      '--bg-sidebar':  '#111111',
      '--border':      '#282828',
      '--border-soft': '#1e1e1e',
      '--text-main':   '#c8c8b4',
      '--text-dim':    '#585850',
      '--text-bright': '#e8e8d0',
      '--color-roomname':  '#80b4e0',
      '--color-speech':    '#80d880',
      '--color-whisper':   '#b0a8d8',
      '--color-thought':   '#c8b888',
      '--color-warning':   '#e89040',
      '--color-bonus':     '#60c060',
      '--health-color':    '#d06060',
      '--mana-color':      '#6080d8',
      '--stamina-color':   '#60b860',
      '--spirit-color':    '#b860b8',
    }
  },
  {
    id: 'wrayth',
    name: 'Wrayth dark',
    vars: {
      '--bg-shell':    '#1a1a2e',
      '--bg-panel':    '#16213e',
      '--bg-input':    '#0f3460',
      '--bg-sidebar':  '#1a1a2e',
      '--border':      '#2a3a5e',
      '--border-soft': '#1e2e4e',
      '--text-main':   '#c8d8e8',
      '--text-dim':    '#5878a0',
      '--text-bright': '#e8f0f8',
      '--color-roomname':  '#90c8f0',
      '--color-speech':    '#90e8a0',
      '--color-whisper':   '#c8b8f0',
      '--color-thought':   '#f0e0b0',
      '--color-warning':   '#f0a050',
      '--color-bonus':     '#70d870',
      '--health-color':    '#f07878',
      '--mana-color':      '#7898f0',
      '--stamina-color':   '#78d078',
      '--spirit-color':    '#d878d8',
    }
  },
  {
    id: 'parchment',
    name: 'Parchment (light)',
    vars: {
      '--bg-shell':    '#f4f0e4',
      '--bg-panel':    '#ece8d8',
      '--bg-input':    '#e8e4d4',
      '--bg-sidebar':  '#e8e4d4',
      '--border':      '#c8c0a8',
      '--border-soft': '#d8d0b8',
      '--text-main':   '#2c2820',
      '--text-dim':    '#887860',
      '--text-bright': '#181410',
      '--color-roomname':  '#3060a0',
      '--color-speech':    '#206840',
      '--color-whisper':   '#5040a0',
      '--color-thought':   '#806020',
      '--color-warning':   '#c04010',
      '--color-bonus':     '#206820',
      '--health-color':    '#a02020',
      '--mana-color':      '#2040a0',
      '--stamina-color':   '#207020',
      '--spirit-color':    '#802080',
    }
  },
]

export function applyTheme(themeId: string): void {
  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0]!
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v)
  }
}
