import { app, BrowserWindow, ipcMain, Menu } from 'electron'
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

const lichLogBuffer: string[] = []

function send(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function lichLog(line: string) {
  lichLogBuffer.push(line)
  if (lichLogBuffer.length > 200) lichLogBuffer.shift()
  send('lich:log', line)
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
  mainWindow.webContents.on('did-finish-load', () => {
    for (const line of lichLogBuffer) {
      send('lich:log', line)
    }
    mainWindow?.webContents.send(
      gameConn.getStatus() === 'connected' ? 'game:connected' : 'game:disconnected'
    )
    send('lich:status', lichManager.getStatus())
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)  // hide default menu bar
  createWindow()
  setupIpcHandlers()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  mainWindow = null
  gameConn.disconnect()
  lichConn.disconnect()
  lichManager.stop()
  if (process.platform !== 'darwin') app.quit()
})

function setupIpcHandlers(): void {
  ipcMain.handle('settings:get-all', () => settings.getAll())
  ipcMain.handle('settings:patch',   (_e, p) => settings.patch(p))

  ipcMain.handle('auth:login', async (_e, account: string, password: string) => {
    const result = await sgeAuth(account, password, (l) => lichLog('[sge] ' + l))
    if (!result.ok) return result
    pendingSelectInstance = result.selectInstance
    settings.saveAccount(account)
    return { ok: true, instances: result.instances }
  })

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

  ipcMain.handle('auth:select-character', async (
    _e, characterId: string, characterName: string, accountName: string
  ) => {
    if (!pendingSelectCharacter) return { ok: false, error: 'Session expired.' }

    // Always do the L step to get a fresh key
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
      // Lich mode: launch with --frostbite -g host:port (exactly like Frostbite)
      // Then connect to Lich's port 4901 and send the key — Lich forwards it to game
      lichLog('[sge] Launching Lich (frostbite mode) for ' + characterName + '...')
      lichManager.spawnOnly(key.host, key.port, lichPath)
      lichLog('[sge] Connecting to Lich on port 11024...')
      gameConn.connectWithKey('127.0.0.1', 11024, key.key)
    } else {
      lichLog('[sge] Connecting directly to ' + key.host + ':' + key.port)
      gameConn.connectDirect(key.host, key.port, key.key)
    }
    return { ok: true }
  })

  ipcMain.handle('lich:get-log',     () => lichLogBuffer.slice())
  ipcMain.handle('lich:detect-path', () => lichManager.getLichPath(settings.get('lichPath') || undefined))
  ipcMain.handle('lich:stop',        () => { lichManager.stop(); lichConn.disconnect() })
  ipcMain.handle('lich:launch-sidecar', (_e, _charName: string) => {
    return { ok: false, error: 'Use the Lich path in Settings to enable Lich at login.' }
  })

  lichManager.on('log',    (l: string) => lichLog(l))
  lichManager.on('status', (s: string) => send('lich:status', s))
  lichManager.on('error',  (m: string) => { lichLog('[error] ' + m); send('lich:error', m) })
  lichManager.on('ready',  (port: number) => {
    lichLog('[lich] Lich ready on port ' + port + ' -- ;commands route through main connection')
    // Don't connect lichConn here -- it would steal gameConn's slot on port 11024
    // ;commands are sent via gameConn directly; Lich intercepts them
  })

  ipcMain.handle('game:get-status', () => gameConn.getStatus())
  ipcMain.handle('game:disconnect', () => gameConn.disconnect())
  ipcMain.handle('game:send', (_e, d: string) => {
    // All commands go through gameConn -- Lich intercepts ; prefixed lines
    gameConn.send(d)
  })

  let lichReadyDetected = false
  gameConn.on('log',          (l: string) => lichLog('[game] ' + l))
  gameConn.on('data',         (r: string) => {
    send('game:data', r)
    if (!lichReadyDetected) {
      // <app char="Name"> appears in the game stream once Lich has connected
      // to the game server and parsed the character name from the initial XML.
      // This is the reliable signal that XMLData.name is set and scripts can run.
      if (/<app[^>]+char=/.test(r)) {
        lichReadyDetected = true
        lichLog('[lich] Character data received -- Lich ready')
        mainWindow?.webContents.send('lich:status', 'ready')
      }
    }
  })
  gameConn.on('connected',    ()          => { lichLog('[game] Connected'); send('game:connected') })
  gameConn.on('disconnected', ()          => send('game:disconnected'))
  gameConn.on('error',        (e: string) => { lichLog('[game] Error: ' + e); send('game:error', e) })
}
