import { useState, useEffect } from 'react'
import { THEMES } from '../../lib/themes'
import { setShowTimestamps, setOutputBuffer } from '../game/GameOutput'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [lichPath,        setLichPath]        = useState('')
  const [fontSize,        setFontSize]        = useState(13)
  const [fontFamily,      setFontFamily]      = useState('Cascadia Code')
  const [theme,           setTheme]           = useState('meridian')
  const [timestamps,      setTimestamps]      = useState(false)
  const [outputBufferSize, setOutputBufferSize] = useState(5000)
  const [version,         setVersion]         = useState('')
  const [saved,           setSaved]           = useState(false)

  useEffect(() => {
    window.dr.app.getVersion().then(setVersion)
    window.dr.settings.getAll().then(s => {
      const st = s as Record<string, unknown>
      setLichPath(st.lichPath as string || '')
      setFontSize(st.fontSize as number || 13)
      setFontFamily(st.fontFamily as string || 'Cascadia Code')
      setTheme(st.theme as string || 'meridian')
      setTimestamps(st.timestamps as boolean || false)
      setOutputBufferSize(st.outputBufferSize as number || 5000)
    })
  }, [])

  const handleSave = async () => {
    await window.dr.settings.patch({
      lichPath, fontSize, fontFamily, theme, timestamps, outputBufferSize
    } as Record<string, unknown>)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    const { applyTheme } = await import('../../lib/themes')
    applyTheme(theme)
    document.documentElement.style.setProperty('--font-game', fontFamily)
    document.documentElement.style.setProperty('--font-size-game', fontSize + 'px')
    setShowTimestamps(timestamps)
    setOutputBuffer(outputBufferSize)
  }

  const versionLabel = !version || version === '0.0.0' ? 'dev' : `v${version}`

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <div className="settings-section-label">Lich</div>
            <label className="settings-row">
              <span className="settings-label">Lich path</span>
              <input
                className="settings-input settings-input-mono"
                type="text"
                placeholder="C:\Ruby4Lich5\Lich5\lich.rbw"
                value={lichPath}
                onChange={e => setLichPath(e.target.value)}
              />
            </label>
          </div>

          <div className="settings-section">
            <div className="settings-section-label">Theme</div>
            <div className="theme-grid">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={'theme-swatch' + (theme === t.id ? ' active' : '')}
                  style={{
                    background:  t.vars['--bg-panel'],
                    borderColor: theme === t.id ? t.vars['--accent'] : t.vars['--border'],
                    boxShadow:   theme === t.id ? `0 0 10px ${t.vars['--accent-glow']}` : 'none',
                  }}
                  onClick={() => setTheme(t.id)}
                >
                  <div style={{ display: 'flex', gap: 2, marginBottom: 5 }}>
                    {['--health-color','--mana-color','--stamina-color','--accent','--color-roomname'].map(k => (
                      <div key={k} style={{ flex:1, height:4, borderRadius:2, background: t.vars[k] }} />
                    ))}
                  </div>
                  <span className="theme-swatch-name" style={{ color: t.vars['--color-roomname'] }}>
                    {t.name}
                  </span>
                  <span className="theme-swatch-preview" style={{ color: t.vars['--text-dim'] }}>
                    <span style={{ color: t.vars['--color-speech'] }}>say </span>
                    <span style={{ color: t.vars['--color-warning'] }}>!</span>
                    <span style={{ color: t.vars['--color-bonus'] }}> ✓</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-label">Display</div>
            <label className="settings-row">
              <span className="settings-label">Font family</span>
              <select
                className="settings-input"
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value)}
              >
                <option>Cascadia Code</option>
                <option>Fira Code</option>
                <option>Consolas</option>
                <option>Courier New</option>
                <option>monospace</option>
              </select>
            </label>
            <label className="settings-row">
              <span className="settings-label">Font size</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range" min={10} max={18} value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 30 }}>
                  {fontSize}px
                </span>
              </div>
            </label>
            <label className="settings-row">
              <span className="settings-label">Timestamps</span>
              <input
                type="checkbox"
                checked={timestamps}
                onChange={e => setTimestamps(e.target.checked)}
                style={{ width: 'auto' }}
              />
            </label>
            <label className="settings-row">
              <span className="settings-label">Output buffer</span>
              <select
                className="settings-input"
                value={outputBufferSize}
                onChange={e => setOutputBufferSize(Number(e.target.value))}
              >
                <option value={1000}>1,000 lines</option>
                <option value={2500}>2,500 lines</option>
                <option value={5000}>5,000 lines</option>
                <option value={10000}>10,000 lines</option>
              </select>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <span className="settings-version">{versionLabel}</span>
          <button className="login-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="login-btn" style={{ minWidth: 80 }} onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
