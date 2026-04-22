import { Socket } from 'net'
import { EventEmitter } from 'events'

export class GameConnection extends EventEmitter {
  private socket: Socket | null = null
  private buffer = ''

  /**
   * Connect directly to the game server using the SGE launch key.
   * Handshake: KEY\n then /FE:STORM\n
   */
  connectDirect(host: string, port: number, key: string): void {
    if (this.socket) this.disconnect()
    this.socket = new Socket()
    this.socket.setEncoding('latin1')

    this.socket.on('connect', () => {
      this.socket!.write(key + '\n', 'latin1')
      this.socket!.write('/FE:STORM\n', 'latin1')
      this.emit('connected')
    })

    this.socket.on('data', (chunk: string) => { this.buffer += chunk; this.flush() })
    this.socket.on('close', () => { this.emit('disconnected'); this.socket = null })
    this.socket.on('error', (err) => this.emit('error', err.message))
    this.socket.connect(port, host)
  }

  /**
   * Connect to Lich's local proxy port with automatic retry on ECONNREFUSED.
   * Lich briefly binds the port during startup before it's actually ready,
   * so we retry every 500ms for up to 30 seconds.
   */
  connect(host: string, port: number): void {
    if (this.socket) this.disconnect()
    this.emit('log', `Attempting to connect to ${host}:${port}…`)
    this._tryConnect(host, port, 0)
  }

  private _tryConnect(host: string, port: number, attempts: number): void {
    if (this.socket) return  // already connected by a previous attempt

    const s = new Socket()
    s.setEncoding('latin1')

    s.on('connect', () => {
      this.socket = s
      this.emit('log', `Connected to Lich proxy on port ${port}`)
      s.write('/FE:STORMFRONT\n', 'latin1')
      this.emit('connected')
    })

    s.on('data', (chunk: string) => { this.buffer += chunk; this.flush() })
    s.on('close', () => { this.emit('disconnected'); this.socket = null })

    s.on('error', (err) => {
      s.destroy()
      if (err.message.includes('ECONNREFUSED') && attempts < 60) {
        // Lich not ready yet — retry after 500ms
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
