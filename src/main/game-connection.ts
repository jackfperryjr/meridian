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
    // Split on newlines but reassemble lines into complete tag groups
    // before emitting. A "complete unit" is either:
    //   1. A line with no open tags (all opened tags are also closed)
    //   2. Everything up to and including a closing tag that was opened earlier
    //
    // Simple heuristic that works for the DR stream: accumulate lines until
    // the open-tag count equals the close-tag count, then emit.

    let pos = 0
    const buf = this.buffer

    while (pos < buf.length) {
      // Find next newline
      const nl = buf.indexOf('\n', pos)
      if (nl === -1) break  // no complete line yet — wait for more data

      const line = buf.slice(pos, nl)
      pos = nl + 1

      // Check if this line has unmatched open tags
      // Count self-closing first, then subtract from opens
      const selfClose = (line.match(/<[a-zA-Z][^>]*\/>/g) ?? []).length
      const closes    = (line.match(/<\/[a-zA-Z]/g) ?? []).length
      const allOpens  = (line.match(/<[a-zA-Z][^>]*>/g) ?? []).length
      const opens     = allOpens - selfClose

      if (opens > closes) {
        // Tag opened but not closed — accumulate until we find the close
        let accumulated = line
        let found = false
        while (pos < buf.length) {
          const nl2 = buf.indexOf('\n', pos)
          if (nl2 === -1) {
            // Not complete yet — put everything back and wait
            this.buffer = accumulated + buf.slice(pos)
            return
          }
          const nextLine = buf.slice(pos, nl2)
          pos = nl2 + 1
          accumulated += ' ' + nextLine.trim()  // join with space, trim leading whitespace

          const s2 = (accumulated.match(/<[a-zA-Z][^>]*\/>/g) ?? []).length
          const c2 = (accumulated.match(/<\/[a-zA-Z]/g) ?? []).length
          const a2 = (accumulated.match(/<[a-zA-Z][^>]*>/g) ?? []).length
          if (a2 - s2 <= c2) {
            // Balanced — emit and continue
            if (accumulated.trim()) this.emit('data', accumulated + '\n')
            found = true
            break
          }
        }
        if (!found) {
          // Still waiting for close tag — put back accumulated + rest
          this.buffer = accumulated + buf.slice(pos)
          return
        }
      } else {
        // Complete line — emit directly
        if (line.trim()) this.emit('data', line + '\n')
      }
    }

    this.buffer = buf.slice(pos)
  }
}
