
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
  // Navigation / social
  hl('also-here',    'Also here:',            '#d4a843', '', true),
  hl('obvious-paths','Obvious paths:',        '#60c878', '', false),
]
export interface Theme {
  id:   string
  name: string
  vars: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    id: 'meridian',
    name: 'Meridian',
    vars: {
      '--bg-shell':      '#0e0d0f',
      '--bg-panel':      '#141218',
      '--bg-input':      '#1a1720',
      '--bg-sidebar':    '#100e14',
      '--border':        '#2c2438',
      '--border-soft':   '#1e1828',
      '--border-accent': '#4a3870',
      '--text-main':     '#c8c0d8',
      '--text-dim':      '#5a5268',
      '--text-bright':   '#ede8f8',
      '--text-muted':    '#7a7090',
      '--accent':        '#7058c0',
      '--accent-glow':   'rgba(112,88,192,0.18)',
      '--accent-dim':    '#3a2e60',
      '--color-roomname':'#d4a843',
      '--color-roomdesc':'#8880a0',
      '--color-speech':  '#7ec8a0',
      '--color-whisper': '#a898d8',
      '--color-thought': '#c890c8',
      '--color-warning': '#e06848',
      '--color-bonus':   '#60c878',
      '--color-penalty': '#d05050',
      '--health-color':  '#c84040',
      '--mana-color':    '#4878d8',
      '--stamina-color': '#3aaa5a',
      '--spirit-color':  '#9050c0',
      '--bg-theme-image': 'none',
    }
  },
  {
    id: 'bloodstone',
    name: 'Bloodstone',
    vars: {
      '--bg-shell':      '#0d0808',
      '--bg-panel':      '#160c0c',
      '--bg-input':      '#1e1010',
      '--bg-sidebar':    '#110909',
      '--border':        '#3a1818',
      '--border-soft':   '#280f0f',
      '--border-accent': '#6a2020',
      '--text-main':     '#d8b8b0',
      '--text-dim':      '#6a4040',
      '--text-bright':   '#f0ddd8',
      '--text-muted':    '#8a5858',
      '--accent':        '#c03030',
      '--accent-glow':   'rgba(192,48,48,0.18)',
      '--accent-dim':    '#4a1010',
      '--color-roomname':'#e08850',
      '--color-roomdesc':'#9a7070',
      '--color-speech':  '#c8a870',
      '--color-whisper': '#c890a0',
      '--color-thought': '#d080c0',
      '--color-warning': '#ff5040',
      '--color-bonus':   '#80c060',
      '--color-penalty': '#e03030',
      '--health-color':  '#e03030',
      '--mana-color':    '#9040c0',
      '--stamina-color': '#c07030',
      '--spirit-color':  '#d04080',
      '--bg-theme-image': 'radial-gradient(ellipse at 80% 20%, rgba(120,20,20,0.15) 0%, transparent 60%)',
    }
  },
  {
    id: 'forest',
    name: 'Thornwood',
    vars: {
      '--bg-shell':      '#080e08',
      '--bg-panel':      '#0c140c',
      '--bg-input':      '#101a10',
      '--bg-sidebar':    '#0a110a',
      '--border':        '#1e3020',
      '--border-soft':   '#142018',
      '--border-accent': '#2e5030',
      '--text-main':     '#b8d0b0',
      '--text-dim':      '#486048',
      '--text-bright':   '#daeeda',
      '--text-muted':    '#688068',
      '--accent':        '#4a9050',
      '--accent-glow':   'rgba(74,144,80,0.18)',
      '--accent-dim':    '#1a3820',
      '--color-roomname':'#c8b050',
      '--color-roomdesc':'#789078',
      '--color-speech':  '#80d890',
      '--color-whisper': '#90c8a8',
      '--color-thought': '#a8d0b8',
      '--color-warning': '#e07840',
      '--color-bonus':   '#60d870',
      '--color-penalty': '#d05040',
      '--health-color':  '#b03030',
      '--mana-color':    '#3880a0',
      '--stamina-color': '#48b858',
      '--spirit-color':  '#60a870',
      '--bg-theme-image': 'radial-gradient(ellipse at 20% 80%, rgba(20,60,20,0.2) 0%, transparent 60%)',
    }
  },
  {
    id: 'parchment',
    name: 'Parchment',
    vars: {
      '--bg-shell':      '#f0e8d0',
      '--bg-panel':      '#e8dfc4',
      '--bg-input':      '#ddd4b8',
      '--bg-sidebar':    '#ebe2ca',
      '--border':        '#c0aa80',
      '--border-soft':   '#d0bc90',
      '--border-accent': '#906030',
      '--text-main':     '#2a1a08',
      '--text-dim':      '#907050',
      '--text-bright':   '#100800',
      '--text-muted':    '#705040',
      '--accent':        '#804010',
      '--accent-glow':   'rgba(128,64,16,0.15)',
      '--accent-dim':    '#d0b888',
      '--color-roomname':'#602000',
      '--color-roomdesc':'#504030',
      '--color-speech':  '#006040',
      '--color-whisper': '#404080',
      '--color-thought': '#600060',
      '--color-warning': '#c02000',
      '--color-bonus':   '#006020',
      '--color-penalty': '#c01010',
      '--health-color':  '#c02020',
      '--mana-color':    '#2040a0',
      '--stamina-color': '#207030',
      '--spirit-color':  '#702080',
      '--bg-theme-image': 'url("data:image/svg+xml,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3CfeColorMatrix%20type%3D%22saturate%22%20values%3D%220%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22%20filter%3D%22url%28%23n%29%22%20opacity%3D%220.04%22%2F%3E%3C%2Fsvg%3E")',
    }
  },
  {
    id: 'ironforge',
    name: 'Ironforge',
    vars: {
      '--bg-shell':      '#0a0a08',
      '--bg-panel':      '#131310',
      '--bg-input':      '#1a1a16',
      '--bg-sidebar':    '#0f0f0c',
      '--border':        '#303028',
      '--border-soft':   '#222220',
      '--border-accent': '#585840',
      '--text-main':     '#c8c4a8',
      '--text-dim':      '#606050',
      '--text-bright':   '#e8e4c8',
      '--text-muted':    '#888870',
      '--accent':        '#b89040',
      '--accent-glow':   'rgba(184,144,64,0.18)',
      '--accent-dim':    '#403010',
      '--color-roomname':'#d4a840',
      '--color-roomdesc':'#908870',
      '--color-speech':  '#90c8a0',
      '--color-whisper': '#a8a880',
      '--color-thought': '#c8a060',
      '--color-warning': '#e06030',
      '--color-bonus':   '#80b840',
      '--color-penalty': '#c04030',
      '--health-color':  '#b03020',
      '--mana-color':    '#3060b0',
      '--stamina-color': '#508030',
      '--spirit-color':  '#806030',
      '--bg-theme-image': 'repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 4px)',
    }
  },
  {
    id: 'frostbite',
    name: 'Frostbite Classic',
    vars: {
      '--bg-shell':      '#000000',
      '--bg-panel':      '#0a0a0a',
      '--bg-input':      '#111111',
      '--bg-sidebar':    '#080808',
      '--border':        '#222222',
      '--border-soft':   '#181818',
      '--border-accent': '#444444',
      '--text-main':     '#c0c0c0',
      '--text-dim':      '#505050',
      '--text-bright':   '#ffffff',
      '--text-muted':    '#808080',
      '--accent':        '#808080',
      '--accent-glow':   'rgba(128,128,128,0.12)',
      '--accent-dim':    '#202020',
      '--color-roomname':'#ffff00',
      '--color-roomdesc':'#c0c0c0',
      '--color-speech':  '#80ffff',
      '--color-whisper': '#80ff80',
      '--color-thought': '#ff80ff',
      '--color-warning': '#ff4040',
      '--color-bonus':   '#40ff40',
      '--color-penalty': '#ff4040',
      '--health-color':  '#ff0000',
      '--mana-color':    '#0000ff',
      '--stamina-color': '#00ff00',
      '--spirit-color':  '#ff00ff',
      '--bg-theme-image': 'none',
    }
  },
]

export function applyTheme(id: string): void {
  const theme = THEMES.find(t => t.id === id) ?? THEMES[0]
  const root  = document.documentElement
  for (const [key, val] of Object.entries(theme.vars)) {
    root.style.setProperty(key, val)
  }
  // Apply background image to body
  const img = theme.vars['--bg-theme-image'] ?? 'none'
  document.body.style.backgroundImage = img
}
