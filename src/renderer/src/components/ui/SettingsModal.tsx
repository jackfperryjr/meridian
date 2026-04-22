import { useState, useEffect } from 'react'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [lichPath,   setLichPath]   = useState('')
  const [fontSize,   setFontSize]   = useState(13)
  const [fontFamily, setFontFamily] = useState('Cascadia Code')
  const [saved,      setSaved]      = useState(false)

  useEffect(() => {
    window.dr.settings.getAll().then(s => {
      setLichPath(s.lichPath || '')
      setFontSize(s.fontSize || 13)
      setFontFamily(s.fontFamily || 'Cascadia Code')
    })
  }, [])

  const handleSave = async () => {
    await window.dr.settings.patch({ lichPath, fontSize, fontFamily })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
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
            <p className="settings-hint">
              Path to lich.rbw. When set, the "Start Lich" button launches Lich as a
              background scripting engine and enables ;script commands.
              Requires credentials saved in Lich's entry.dat — launch Lich's own GTK UI
              once and check "Save this info for quick game entry" for your character.
            </p>
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
                  type="range"
                  min={10}
                  max={18}
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 30 }}>
                  {fontSize}px
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="login-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="login-btn" style={{ minWidth: 80 }} onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
