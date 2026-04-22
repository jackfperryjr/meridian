import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { LichManager, LichConnection } from './lich-manager'
import { GameConnection } from './game-connection'
import { SettingsStore } from './settings-store'
import { sgeAuth } from './sge-auth'
import type { SGELaunchKey } from './sge-auth'

let mainWindow: BrowserWindow | null = null
const lichManager = new LichManager()
const gameConn    = new GameConnection()
const lichConn    = new LichConnection()
const settings    = new SettingsStore()

// Persistent log buffer — survives the login→game transition
const lichLogBuffer: string[] = []
function lichLog(line: string) {
  lichLogBuffer.push(line)
  if (lichLogBuffer.length > 200) lichLogBuffer.shift()
  mainWindow?.webContents.send('lich:log', line)
}

let pendingSelectInstance:  ((code: string) => Promise<unknown>) | null = null
let pendingSelectCharacter: ((id: string)   => Promise<SGELaunchKey>) | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 600,
    backgroundColor: '#111113',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false, contextIsolation: true, nodeIntegration: false
    }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // When renderer reloads/mounts, replay the log buffer so it sees all history
  mainWindow.webContents.on('did-finish-load', () => {
    for (const line of lichLogBuffer) {
      mainWindow?.webContents.send('lich:log', line)
    }
    // Also sync connection status
    mainWindow?.webContents.send(
      gameConn.getStatus() === 'connected' ? 'game:connected' : 'game:disconnected'
    )
    mainWindow?.webContents.send('lich:status', lichManager.getStatus())
  })
}

app.whenReady().then(() => {
  createWindow()
  setupIpcHandlers()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  gameConn.disconnect()
  lichConn.disconnect()
  lichManager.stop()
  if (process.platform !== 'darwin') app.quit()
})

function setupIpcHandlers(): void {
  // ── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get-all', () => settings.getAll())
  ipcMain.handle('settings:patch',   (_e, p) => settings.patch(p))

  // ── Auth step 1 ─────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_e, account: string, password: string) => {
    const result = await sgeAuth(account, password, (l) => lichLog(`[sge] ${l}`))
    if (!result.ok) return result
    pendingSelectInstance = result.selectInstance
    settings.saveAccount(account)
    return { ok: true, instances: result.instances }
  })

  // ── Auth step 2 ─────────────────────────────────────────────────────────────
  ipcMain.handle('auth:select-instance', async (_e, code: string) => {
    if (!pendingSelectInstance) return { ok: false, error: 'Session expired.' }
    const result = await (pendingSelectInstance as (c: string) => Promise<{
      ok: boolean; error?: string; characters?: unknown[];
      selectCharacter?: (id: string) => Promise<SGELaunchKey>
    }>)(code)
    if (!result.ok) return result
    pendingSelectCharacter = result.selectCharacter ?? null
    return { ok: true, characters: result.characters }
  })

  // ── Auth step 3 ─────────────────────────────────────────────────────────────
  ipcMain.handle('auth:select-character', async (
    _e, characterId: string, characterName: string, accountName: string
  ) => {
    if (!pendingSelectCharacter) return { ok: false, error: 'Session expired.' }

    let key: SGELaunchKey
    try {
      key = await pendingSelectCharacter(characterId)
    } catch (e: unknown) {
      return { ok: false, error: String(e) }
    }
    pendingSelectCharacter = null
    settings.saveAccount(accountName, characterName)

    const lichPath = settings.get('lichPath')

    if (lichPath) {
      lichLog(`[sge] Launching Lich for ${characterName}…`)
      const result = lichManager.launchDetachable(characterName, lichPath, 11024)
      if (!result.ok) return result

      lichManager.once('ready', (port: number) => {
        lichLog(`[sge] Connecting to Lich on port ${port}…`)
        gameConn.connect('127.0.0.1', port)
      })
    } else {
      lichLog(`[sge] Connecting directly to ${key.host}:${key.port}`)
      gameConn.connectDirect(key.host, key.port, key.key)
    }

    return { ok: true }
  })

  // ── Lich log history (for when renderer mounts after events fired) ───────────
  ipcMain.handle('lich:get-log', () => lichLogBuffer.slice())

  // ── Lich control ─────────────────────────────────────────────────────────────
  ipcMain.handle('lich:detect-path', () =>
    lichManager.getLichPath(settings.get('lichPath') || undefined)
  )
  ipcMain.handle('lich:stop', () => { lichManager.stop(); lichConn.disconnect() })
  ipcMain.handle('lich:launch-sidecar', (_e, charName: string) => {
    const lichPath = settings.get('lichPath') || undefined
    if (!lichPath) return { ok: false, error: 'No Lich path configured in Settings.' }
    return lichManager.launchForScripts(charName, lichPath, 4901)
  })

  lichManager.on('log',    (l: string) => lichLog(l))
  lichManager.on('status', (s: string) => mainWindow?.webContents.send('lich:status', s))
  lichManager.on('error',  (m: string) => {
    lichLog(`[error] ${m}`)
    mainWindow?.webContents.send('lich:error', m)
  })
  lichManager.on('ready', (port: number) => {
    lichLog(`[lich] Ready on port ${port}`)
    setTimeout(() => lichConn.connect(4901), 3000)
  })

  // ── Game socket ──────────────────────────────────────────────────────────────
  ipcMain.handle('game:get-status', () => gameConn.getStatus())
  ipcMain.handle('game:disconnect', () => gameConn.disconnect())
  ipcMain.handle('game:send', (_e, d: string) => {
    if (d.startsWith(';') && lichConn.isConnected()) {
      lichConn.send(d)
    } else {
      gameConn.send(d)
    }
  })

  gameConn.on('log',          (l: string) => lichLog(`[game] ${l}`))
  gameConn.on('data',         (r: string) => mainWindow?.webContents.send('game:data', r))
  gameConn.on('connected',    ()          => {
    lichLog('[game] Connected to game server')
    mainWindow?.webContents.send('game:connected')
  })
  gameConn.on('disconnected', ()          => mainWindow?.webContents.send('game:disconnected'))
  gameConn.on('error',        (e: string) => {
    lichLog(`[game] Error: ${e}`)
    mainWindow?.webContents.send('game:error', e)
  })
}
