import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dr', {
  settings: {
    getAll: ()          => ipcRenderer.invoke('settings:get-all'),
    patch:  (p: object) => ipcRenderer.invoke('settings:patch', p)
  },
  auth: {
    login: (account: string, password: string) =>
      ipcRenderer.invoke('auth:login', account, password),
    selectInstance: (instanceCode: string) =>
      ipcRenderer.invoke('auth:select-instance', instanceCode),
    selectCharacter: (characterId: string, characterName: string, accountName: string) =>
      ipcRenderer.invoke('auth:select-character', characterId, characterName, accountName)
  },
  lich: {
    detectPath: ()                  => ipcRenderer.invoke('lich:detect-path'),
    getLog:     ()                  => ipcRenderer.invoke('lich:get-log'),
    stop:         ()                  => ipcRenderer.invoke('lich:stop'),
    launchSidecar: (charName: string) => ipcRenderer.invoke('lich:launch-sidecar', charName),
    onLog:    (cb: (l: string) => void) => { const h = (_e: unknown, l: string) => cb(l); ipcRenderer.on('lich:log', h);    return () => ipcRenderer.removeListener('lich:log', h) },
    onStatus: (cb: (s: string) => void) => { const h = (_e: unknown, s: string) => cb(s); ipcRenderer.on('lich:status', h); return () => ipcRenderer.removeListener('lich:status', h) },
    onError:  (cb: (m: string) => void) => { const h = (_e: unknown, m: string) => cb(m); ipcRenderer.on('lich:error', h);  return () => ipcRenderer.removeListener('lich:error', h) }
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version')
  },
  updater: {
    check:       ()                         => ipcRenderer.invoke('updater:check'),
    install:     ()                         => ipcRenderer.invoke('updater:install'),
    onAvailable: (cb: (v: string) => void) => { const h = (_e: unknown, v: string) => cb(v); ipcRenderer.on('updater:available', h); return () => ipcRenderer.removeListener('updater:available', h) },
    onReady:     (cb: () => void)           => { ipcRenderer.on('updater:ready', cb); return () => ipcRenderer.removeListener('updater:ready', cb) }
  },
  game: {
    getStatus:  ()          => ipcRenderer.invoke('game:get-status'),
    disconnect: ()          => ipcRenderer.invoke('game:disconnect'),
    send:       (d: string) => ipcRenderer.invoke('game:send', d),
    onData:         (cb: (r: string) => void) => { const h = (_e: unknown, r: string) => cb(r); ipcRenderer.on('game:data', h);         return () => ipcRenderer.removeListener('game:data', h) },
    onConnected:    (cb: () => void)           => {                                               ipcRenderer.on('game:connected', cb);    return () => ipcRenderer.removeListener('game:connected', cb) },
    onDisconnected: (cb: () => void)           => {                                               ipcRenderer.on('game:disconnected', cb); return () => ipcRenderer.removeListener('game:disconnected', cb) },
    onError:        (cb: (e: string) => void)  => { const h = (_e: unknown, e: string) => cb(e); ipcRenderer.on('game:error', h);         return () => ipcRenderer.removeListener('game:error', h) }
  }
})
