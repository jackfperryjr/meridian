import { Socket } from 'net'
import { EventEmitter } from 'events'

export class GameConnection extends EventEmitter {
  private socket: Socket | null = null
  private buffer = ''

  /** Direct connection to game server: send KEY then /FE:STORM */
  connectDirect(host: string, port: number, key: string): void {
    if (this.socket) this.disconnect()
    this.socket = new Socket()
    this.socket.setEncoding('latin1')
    this.socket.on('connect', () => {
      this.socket!.write(key + '\n', 'latin1')
      this.socket!.write('/FE:STORM\n', 'latin1')
      this.emit('connected')
    })
    this.socket.on('data',  (c: string) => { this.buffer += c; this.flush() })
    this.socket.on('close', ()          => { this.emit('disconnected'); this.socket = null })
    this.socket.on('error', (e)         => this.emit('error', e.message))
    this.socket.connect(port, host)
  }

  /**
   * Connect to Lich's --frostbite proxy port (4901) and send the SGE key.
   * This is exactly how Frostbite connects to Lich:
   *   1. TCP connect to 127.0.0.1:4901
   *   2. Send KEY + newline  (Lich forwards this to the game server)
   *   3. Game stream flows back
   * Retries on ECONNREFUSED until Lich opens its port.
   */
  connectWithKey(host: string, port: number, key: string): void {
    if (this.socket) this.disconnect()
    this.emit('log', 'Attempting to connect to ' + host + ':' + port + '...')
    this._tryConnectWithKey(host, port, key, 0)
  }

  private _tryConnectWithKey(host: string, port: number, key: string, attempts: number): void {
    if (this.socket) return
    const s = new Socket()
    s.setEncoding('latin1')
    s.on('connect', () => {
      this.socket = s
      this.emit('log', 'Connected to Lich on port ' + port + ', sending key...')
      s.write(key + '\n', 'latin1')
      this.emit('connected')
    })
    s.on('data',  (c: string) => {
      if (this.buffer.length === 0) {
        // Log first chunk to see what Lich sends back
        this.emit('log', 'First data from Lich (' + c.length + ' bytes): ' + JSON.stringify(c.slice(0, 80)))
      }
      this.buffer += c; this.flush()
    })
    s.on('close', ()          => { this.emit('disconnected'); this.socket = null })
    s.on('error', (err) => {
      s.destroy()
      if (err.message.includes('ECONNREFUSED') && attempts < 240) {
        setTimeout(() => this._tryConnectWithKey(host, port, key, attempts + 1), 500)
      } else {
        this.emit('error', err.message)
      }
    })
    s.connect(port, host)
  }

  /** Connect to Lich proxy without sending a key (for already-authenticated sessions) */
  connect(host: string, port: number): void {
    if (this.socket) this.disconnect()
    this.emit('log', 'Attempting to connect to ' + host + ':' + port + '...')
    this._tryConnect(host, port, 0)
  }

  private _tryConnect(host: string, port: number, attempts: number): void {
    if (this.socket) return
    const s = new Socket()
    s.setEncoding('latin1')
    s.on('connect', () => {
      this.socket = s
      this.emit('log', 'Connected to ' + host + ':' + port)
      this.emit('connected')
    })
    s.on('data',  (c: string) => { this.buffer += c; this.flush() })
    s.on('close', ()          => { this.emit('disconnected'); this.socket = null })
    s.on('error', (err) => {
      s.destroy()
      if (err.message.includes('ECONNREFUSED') && attempts < 240) {
        setTimeout(() => this._tryConnect(host, port, attempts + 1), 500)
      } else {
        this.emit('error', err.message)
      }
    })
    s.connect(port, host)
  }

  getStatus(): 'connected' | 'disconnected' {
    return (this.socket && !this.socket.destroyed) ? 'connected' : 'disconnected'
  }

  disconnect(): void {
    this.socket?.destroy()
    this.socket = null
    this.buffer = ''
  }

  send(data: string): void {
    if (!this.socket || this.socket.destroyed) return
    this.socket.write(data.endsWith('\n') ? data : data + '\n', 'latin1')
  }

  private flush(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.length > 0) this.emit('data', line + '\n')
    }
  }
}
