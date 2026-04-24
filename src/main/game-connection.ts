import { Socket } from 'net'
import { EventEmitter } from 'events'

export class GameConnection extends EventEmitter {
  private socket: Socket | null = null
  private buffer = ''

  connectDirect(host: string, port: number, key: string): void {
    if (this.socket) this.disconnect()
    this.socket = new Socket()
    this.socket.setEncoding('latin1')
    this.socket.on('connect', () => {
      this.socket!.write(key + '\n', 'latin1')
      this.socket!.write('/FE:STORMFRONT\n', 'latin1')
      this.emit('connected')
    })
    this.socket.on('data',  (c: string) => { this.buffer += c; this.flush() })
    this.socket.on('close', ()          => { this.emit('disconnected'); this.socket = null })
    this.socket.on('error', (e)         => this.emit('error', e.message))
    this.socket.connect(port, host)
  }

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
      this.emit('log', 'Connected to Lich on port ' + port + ', sending key + FE token...')
      s.write(key + '\n', 'latin1')
      s.write('/FE:STORMFRONT\n', 'latin1')
      this.emit('connected')
    })
    s.on('data',  (c: string) => { this.buffer += c; this.flush() })
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

  /**
   * Emit complete logical chunks to the renderer.
   *
   * The game stream uses XML tags that can span multiple newlines, e.g.:
   *   <component id='room exits'>Obvious paths: southwest\n, west\n.</component>
   *
   * Strategy: emit a chunk whenever we see a complete self-closing tag OR a
   * close tag, OR a bare text line with no open tags. This ensures the parser
   * always receives complete XML units, never half-open tags.
   */
  private flush(): void {
    // Accumulate lines until all opened tags are closed, then emit as one chunk.
    // This handles multi-line XML like:
    //   <component id='room exits'>northeast\nnorthwest</component>
    // Special case: self-closing tags like <pushStream id='exp'/> are complete on one line.

    let pos   = 0
    const buf = this.buffer
    let depth = 0     // net open tag depth across accumulated lines
    let accum = ''

    while (pos < buf.length) {
      const nl = buf.indexOf('\n', pos)
      if (nl === -1) break  // incomplete line — wait

      const line = buf.slice(pos, nl)
      pos = nl + 1

      // Count tag depth change on this line
      const selfClose = (line.match(/<[a-zA-Z][^>]*\/>/g) ?? []).length
      const opens     = (line.match(/<[a-zA-Z][^>]*>/g) ?? []).length - selfClose
      const closes    = (line.match(/<\/[a-zA-Z]/g) ?? []).length
      depth += opens - closes

      if (accum) {
        accum += ' ' + line.trim()
      } else {
        accum = line
      }

      if (depth <= 0) {
        // If the accumulated line ends with a comma, it's a split list — keep going
        if (accum.trimEnd().endsWith(',')) {
          // don't emit yet, keep accumulating
        } else {
          if (accum.trim()) this.emit('data', accum + '\n')
          accum = ''
          depth = 0
        }
      }
    }

    // Put back any incomplete accumulation
    this.buffer = accum ? accum + buf.slice(pos) : buf.slice(pos)
  }
}
