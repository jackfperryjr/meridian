import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { createConnection, Socket } from 'net'

export type LichStatus = 'stopped' | 'starting' | 'ready' | 'error'

export class LichManager extends EventEmitter {
  private process:   ChildProcess | null = null
  private status:    LichStatus = 'stopped'
  private pollTimer: ReturnType<typeof setInterval> | null = null

  getLichPath(override?: string): string {
    if (override && existsSync(override)) return override
    const home = process.env['HOME'] || process.env['USERPROFILE'] || ''
    const candidates = [
      'C:\\Ruby4Lich5\\Lich5\\lich.rbw',
      join('C:\\', 'Ruby4Lich5', 'Lich5', 'lich.rbw'),
      join(home, 'Desktop', 'Lich5', 'lich.rbw'),
      'C:\\lich5\\lich.rbw',
      join(home, 'lich5', 'lich.rbw'),
      join(home, 'lich5', 'lich.rb'),
    ]
    return candidates.find(existsSync) ?? ''
  }

  getRubyPath(): string {
    const candidates = [
      'C:\\Ruby4Lich5\\4.0.0\\bin\\ruby.exe',
      'C:\\Ruby4Lich5\\bin\\ruby.exe',
      'C:\\Ruby31\\bin\\ruby.exe',
      'ruby',
    ]
    return candidates.find(p => p === 'ruby' || existsSync(p)) ?? 'ruby'
  }

  /**
   * Spawn Lich and immediately start gameConn retrying its proxy port.
   * Lich opens port 11024 within ~2-3s; the retry loop catches it.
   * No polling here — the caller (index.ts) drives the connection.
   */
  spawnOnly(characterName: string, lichPathOverride?: string): { ok: boolean; error?: string } {
    if (this.process) this.stop()

    const lichPath = this.getLichPath(lichPathOverride)
    if (!lichPath) {
      this.setStatus('error')
      return { ok: false, error: 'Lich not found. Set the path in Settings.' }
    }

    const rubyPath = this.getRubyPath()
    const lichDir  = dirname(lichPath)

    const args = [
      lichPath,
      `--home=${lichDir}`,
      `--login=${characterName}`,
      '--dragonrealms',
    ]

    this.emit('log', `Launching Lich: ${rubyPath} ${args.join(' ')}`)
    this.setStatus('starting')
    this._spawn(rubyPath, args)

    // Signal ready after 5s so lichConn can connect to port 4901.
    // The actual game connection (port 11024) is handled by gameConn's retry loop.
    setTimeout(() => {
      if (this.status === 'starting') {
        this.setStatus('ready')
        this.emit('ready', 4901)
      }
    }, 5000)

    return { ok: true }
  }

  /**
   * Launch Lich in detachable-client mode for script execution only.
   * Uses port polling since this mode doesn't broker the game connection.
   */
  launchForScripts(
    characterName: string,
    lichPathOverride?: string,
    port = 4901
  ): { ok: boolean; error?: string } {
    if (this.status === 'starting' || this.status === 'ready') return { ok: true }
    if (this.process) this.stop()

    const lichPath = this.getLichPath(lichPathOverride)
    if (!lichPath) {
      this.setStatus('error')
      return { ok: false, error: 'Lich not found. Set the path in Settings.' }
    }

    const rubyPath = this.getRubyPath()
    const lichDir  = dirname(lichPath)

    const args = [
      lichPath,
      `--home=${lichDir}`,
      `--detachable-client=${port}`,
      '--without-frontend',
      '--dragonrealms',
    ]

    this.emit('log', `Launching Lich (script mode): ${rubyPath} ${args.join(' ')}`)
    this.setStatus('starting')
    this._spawn(rubyPath, args)
    this._pollPort(port)
    return { ok: true }
  }

  stop(): void {
    this.clearPoll()
    this.process?.kill('SIGTERM')
    this.process = null
    this.setStatus('stopped')
  }

  getStatus(): LichStatus { return this.status }

  private _spawn(rubyPath: string, args: string[]): void {
    this.process = spawn(rubyPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.process.stdin?.end()

    this.process.stdout?.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach(l => this.emit('log', l))
    })
    this.process.stderr?.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach(l => {
        this.emit('log', `[stderr] ${l}`)
        if (/error|failed|invalid|no such|cannot/i.test(l) && this.status !== 'ready') {
          this.setStatus('error')
          this.emit('error', l.trim())
        }
      })
    })
    this.process.on('exit', (code, signal) => {
      this.clearPoll()
      if (this.status === 'ready') {
        this.setStatus('stopped')
      } else {
        const reason = signal
          ? `terminated by signal ${signal}`
          : code !== null ? `exited with code ${code}` : 'terminated unexpectedly'
        this.emit('log', `[lich] Process ${reason}`)
        this.setStatus('error')
        this.emit('error', `Lich ${reason}. Check the log above for details.`)
      }
      this.process = null
    })
  }

  private _pollPort(port: number): void {
    this.clearPoll()
    let attempts = 0
    this.pollTimer = setInterval(() => {
      attempts++
      if (attempts % 30 === 0) {
        this.emit('log', `[lich] Still waiting for Lich to start… (${attempts}s elapsed)`)
      }
      if (attempts > 300) {
        this.clearPoll()
        this.setStatus('error')
        this.emit('error', 'Timed out waiting for Lich scripting port (5 min).')
        return
      }
      const s = createConnection({ port, host: '127.0.0.1' })
      s.on('connect', () => {
        s.destroy()
        this.clearPoll()
        this.setStatus('ready')
        this.emit('ready', port)
      })
      s.on('error', () => s.destroy())
    }, 1000)
  }

  private setStatus(s: LichStatus) {
    this.status = s
    this.emit('status', s)
  }

  private clearPoll(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
  }
}

// ── LichConnection ─────────────────────────────────────────────────────────────
export class LichConnection extends EventEmitter {
  private socket: Socket | null = null

  connect(port = 4901): void {
    if (this.socket) { this.socket.destroy(); this.socket = null }
    const s = new Socket()
    s.setEncoding('latin1')
    s.on('connect', () => { this.socket = s; this.emit('connected') })
    s.on('close',   () => { this.socket = null })
    s.on('error',   () => { this.socket = null })
    s.connect(port, '127.0.0.1')
  }

  send(cmd: string): boolean {
    if (!this.socket || this.socket.destroyed) return false
    this.socket.write(cmd.endsWith('\n') ? cmd : cmd + '\n', 'latin1')
    return true
  }

  isConnected(): boolean {
    return !!(this.socket && !this.socket.destroyed)
  }

  disconnect(): void {
    this.socket?.destroy()
    this.socket = null
  }
}
