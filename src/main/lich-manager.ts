import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import { join } from 'path'
import { createConnection, Socket } from 'net'

export type LichStatus = 'stopped' | 'starting' | 'ready' | 'error'

export class LichManager extends EventEmitter {
  private process:    ChildProcess | null = null
  private status:     LichStatus = 'stopped'
  private pollTimer:  ReturnType<typeof setInterval> | null = null

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
   * Launch Lich in --login mode where it connects to the game server itself
   * and opens a local port for us to connect to as a frontend.
   *
   * We detect readiness by watching stdout for "Waiting for the client to connect"
   * instead of polling the port — polling would steal the connection slot.
   */
  launchDetachable(
    characterName: string,
    lichPathOverride?: string,
    port = 11024
  ): { ok: boolean; error?: string } {
    if (this.status === 'starting' || this.status === 'ready') return { ok: true }
    if (this.process) this.stop()

    const lichPath = this.getLichPath(lichPathOverride)
    if (!lichPath) {
      this.setStatus('error')
      return { ok: false, error: 'Lich not found. Set the path in Settings.' }
    }

    const rubyPath = this.getRubyPath()
    const lichDir = lichPath.replace(/[/\\][^/\\]+$/, '')

    const args = [
      lichPath,
      `--home=${lichDir}`,
      `--login=${characterName}`,
      `--detachable-client=${port}`,
      '--without-frontend',
      '--dragonrealms',
    ]

    this.emit('log', `Launching Lich (detachable): ${rubyPath} ${args.join(' ')}`)
    this.emit('log', `Lich home: ${lichDir}`)
    this.emit('log', `Expects entry.yaml at: ${lichDir}\\data\\entry.yaml`)
    this.setStatus('starting')

    // Watch stdout for the "Waiting for the client" line to signal readiness.
    // Do NOT poll the port — that would consume Lich's one connection slot.
    this._spawnWatchStdout(rubyPath, args, port, /Waiting for the client|Listening on port|client to connect/i)

    // No timeout — Lich may need time to download map files on first run.
    // We wait indefinitely for the stdout signal.

    return { ok: true }
  }

  /**
   * Launch Lich in --detachable-client mode for script execution only.
   * In this mode Lich doesn't broker the game connection, so polling is safe.
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
    const lichDir = lichPath.replace(/[/\\][^/\\]+$/, '')

    const args = [
      lichPath,
      `--home=${lichDir}`,
      `--login=${characterName}`,
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

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _spawnWatchStdout(
    rubyPath: string,
    args: string[],
    port: number,
    readyPattern: RegExp
  ): void {
    this.process = spawn(rubyPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.process.stdin?.end()

    const checkReady = (text: string) => {
      if (readyPattern.test(text) && this.status === 'starting') {
        this.clearPoll()
        this.setStatus('ready')
        this.emit('ready', port)
      }
    }

    this.process.stdout?.on('data', (d: Buffer) => {
      const text = d.toString()
      text.split('\n').filter(Boolean).forEach(l => this.emit('log', l))
      checkReady(text)
    })

    this.process.stderr?.on('data', (d: Buffer) => {
      const text = d.toString()
      text.split('\n').filter(Boolean).forEach(l => {
        this.emit('log', `[stderr] ${l}`)
        // Check stderr for ready signal too (Lich may write there on Windows)
        checkReady(l)
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
        const reason = signal ? `terminated by signal ${signal}`
          : code !== null ? `exited with code ${code}` : 'terminated unexpectedly'
        this.emit('log', `[lich] Process ${reason}`)
        this.setStatus('error')
        this.emit('error', `Lich ${reason}. Check the log above for details.`)
      }
      this.process = null
    })
  }

  private _spawn(rubyPath: string, args: string[]): void {
    this.process = spawn(rubyPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.process.stdin?.end()

    this.process.stdout?.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach(l => this.emit('log', l))
    })
    this.process.stderr?.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach(l => {
        this.emit('log', `[stderr] ${l}`)
        if (/error|failed|invalid|no such|cannot/i.test(l)) {
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
        const reason = signal ? `terminated by signal ${signal}`
          : code !== null ? `exited with code ${code}` : 'terminated unexpectedly'
        this.emit('log', `[lich] Process ${reason}`)
        this.setStatus('error')
        this.emit('error', `Lich ${reason}. Check the log above for details.`)
      }
      this.process = null
    })
  }

  /** Poll port for script-mode Lich (safe because it uses --detachable-client) */
  private _pollPort(port: number): void {
    this.clearPoll()
    let attempts = 0
    this.pollTimer = setInterval(() => {
      if (++attempts > 90) {
        this.clearPoll()
        this.setStatus('error')
        this.emit('error', 'Timed out waiting for Lich scripting port (90s).')
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
    if (this.pollTimer) {
      clearInterval(this.pollTimer as ReturnType<typeof setInterval>)
      clearTimeout(this.pollTimer as unknown as ReturnType<typeof setTimeout>)
      this.pollTimer = null
    }
  }
}

// ── LichConnection ────────────────────────────────────────────────────────────
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
