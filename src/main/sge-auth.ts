import { Socket } from 'net'

/**
 * Simutronics SGE authentication protocol (eaccess.play.net:7900, plain TCP).
 * Spec: https://gswiki.play.net/SGE_protocol/saved_posts
 *
 * Correct full flow (per GM Ildran):
 *   K           → hash seed
 *   A acct hash → KEY confirmation
 *   M           → instance list
 *   F code      → subscription check
 *   G code      → game info (required before C)
 *   P code      → pricing info (required before C)
 *   C           → character list
 *   L id STORM  → launch key
 */

export interface SGECharacter  { id: string; name: string }
export interface SGEInstance   { code: string; name: string }
export interface SGELaunchKey  { host: string; port: number; key: string }

export type SGEAuthResult =
  | {
      ok:                true
      instances:         SGEInstance[]
      selectInstance:    (code: string) => Promise<SGEInstanceResult>
    }
  | { ok: false; error: string }

export type SGEInstanceResult =
  | {
      ok:               true
      characters:       SGECharacter[]
      selectCharacter:  (id: string) => Promise<SGELaunchKey>
    }
  | { ok: false; error: string }

const EACCESS_HOST = 'eaccess.play.net'
const EACCESS_PORT = 7900

export function sgeAuth(
  account:  string,
  password: string,
  onLog?:   (line: string) => void
): Promise<SGEAuthResult> {
  const log = (msg: string) => onLog?.(msg)

  return new Promise((resolve) => {
    const sock = new Socket()
    let   buf  = ''
    let   step: 'k' | 'auth' | 'instances' = 'k'
    let   settled = false

    const fail = (msg: string) => {
      if (settled) return
      settled = true
      sock.destroy()
      resolve({ ok: false, error: msg })
    }

    sock.setEncoding('latin1')
    sock.setTimeout(20_000)
    sock.on('timeout', () => fail('Connection to eaccess.play.net timed out (20s).'))
    sock.on('error',   (e) => fail(`Socket error: ${e.message}`))
    sock.on('close',   () => { if (!settled) fail('Connection closed unexpectedly.') })

    const send = (s: string) => {
      log(`→ ${s.replace(/\t/g, '\\t')}`)
      sock.write(s + '\n', 'latin1')
    }

    sock.on('data', (chunk: string) => {
      buf += chunk
      let nl: number
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (line.length > 0) {
          log(`← ${(line.length > 160 ? line.slice(0, 160) + '…' : line).replace(/\t/g, '\\t')}`)
          handleLine(line)
        }
      }
    })

    const handleLine = (line: string) => {
      switch (step) {
        case 'k': {
          // Received hash seed — hash password and authenticate
          const hashed = hashPassword(password, line)
          send(`A\t${account}\t${hashed}`)
          step = 'auth'
          break
        }
        case 'auth': {
          if (!line.includes('\tKEY\t')) {
            fail('Incorrect account name or password.')
            return
          }
          send('M')
          step = 'instances'
          break
        }
        case 'instances': {
          // M\tcode\tname\tcode\tname\t...
          const parts = line.split('\t').slice(1)
          const instances: SGEInstance[] = []
          for (let i = 0; i + 1 < parts.length; i += 2) {
            const code = parts[i]?.trim()
            const name = parts[i + 1]?.trim()
            if (code && name) instances.push({ code, name })
          }
          log(`Instances: ${instances.map(i => i.code).join(', ')}`)

          if (instances.length === 0) {
            fail('No game instances returned. Check your subscription.')
            return
          }

          if (!settled) {
            settled = true
            // Hand control back to the UI — it will call selectInstance when
            // the user picks one (or we auto-select if there's only DR options)
            resolve({
              ok: true,
              instances,
              selectInstance: (code: string) =>
                selectInstance(sock, code, onLog)
            })
          }
          break
        }
      }
    }

    sock.connect(EACCESS_PORT, EACCESS_HOST, () => {
      log(`Connected to ${EACCESS_HOST}:${EACCESS_PORT}`)
      send('K')
    })
  })
}

function selectInstance(
  sock:   Socket,
  code:   string,
  onLog?: (s: string) => void
): Promise<SGEInstanceResult> {
  const log = (msg: string) => onLog?.(msg)

  return new Promise((resolve) => {
    let buf  = ''
    // We need to go through F → G → P → C in sequence
    let step: 'sub' | 'game' | 'price' | 'chars' = 'sub'

    const fail = (msg: string) => {
      sock.destroy()
      resolve({ ok: false, error: msg })
    }

    const send = (s: string) => {
      log(`→ ${s.replace(/\t/g, '\\t')}`)
      sock.write(s + '\n', 'latin1')
    }

    const onData = (chunk: string) => {
      buf += chunk
      let nl: number
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (line.length > 0) {
          log(`← ${(line.length > 160 ? line.slice(0, 160) + '…' : line).replace(/\t/g, '\\t')}`)
          handleLine(line)
        }
      }
    }

    sock.on('data', onData)

    const handleLine = (line: string) => {
      switch (step) {
        case 'sub': {
          // F\tcode\tPREMIUM  or  F\tcode\tEXPIRED  etc.
          if (!line.startsWith('F')) break
          const status = line.split('\t')[2]?.trim()
          if (status === 'EXPIRED' || status === 'NEW_TO_GAME') {
            fail(`No active subscription to this game instance (${status}).`)
            return
          }
          // Must send G (game info) before C will return characters
          send(`G\t${code}`)
          step = 'game'
          break
        }
        case 'game': {
          // G response — just discard it, send P next
          if (!line.startsWith('G')) break
          send(`P\t${code}`)
          step = 'price'
          break
        }
        case 'price': {
          // P response — just discard, now request character list
          if (!line.startsWith('P')) break
          send('C')
          step = 'chars'
          break
        }
        case 'chars': {
          if (!line.startsWith('C') || line.length < 3) break

          const parts = line.split('\t')
          log(`Character line: ${parts.length} fields — ${JSON.stringify(parts.slice(0, 12))}`)

          // Format: C\tnc\tns\tx\tx\tid\tname\tid\tname\t...
          // Some servers omit the two unknown fields (offset 3 vs 5)
          const characters: SGECharacter[] = []
          for (const offset of [5, 3]) {
            const candidates: SGECharacter[] = []
            for (let i = offset; i + 1 < parts.length; i += 2) {
              const id   = parts[i]?.trim()
              const name = parts[i + 1]?.trim()
              if (id && name && name.length >= 2 && !/^\d+$/.test(name)) {
                candidates.push({ id, name })
              }
            }
            if (candidates.length > 0) {
              log(`Parsed ${candidates.length} character(s) at offset ${offset}`)
              characters.push(...candidates)
              break
            }
          }

          if (characters.length === 0) {
            log(`WARNING: No characters parsed. Raw: ${JSON.stringify(parts)}`)
          }

          sock.off('data', onData)
          resolve({
            ok: true,
            characters,
            selectCharacter: (charId: string) => selectCharacter(sock, charId, onLog)
          })
          break
        }
      }
    }

    // Kick off with F (subscription check for this instance)
    send(`F\t${code}`)
  })
}

function selectCharacter(
  sock:   Socket,
  charId: string,
  onLog?: (s: string) => void
): Promise<SGELaunchKey> {
  const log = (msg: string) => onLog?.(msg)

  return new Promise((resolve, reject) => {
    let buf = ''
    sock.setEncoding('latin1')

    const onData = (chunk: string) => {
      buf += chunk
      let nl: number
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (!line.startsWith('L\t')) continue

        log(`Launch response: ${line.slice(0, 160).replace(/\t/g, '\\t')}`)

        const parts = line.split('\t')
        if (parts[1] !== 'OK') {
          sock.off('data', onData)
          sock.destroy()
          reject(new Error(`Launch rejected: ${parts[1] ?? 'unknown'}`))
          return
        }

        const kv: Record<string, string> = {}
        for (const part of parts.slice(2)) {
          const eq = part.indexOf('=')
          if (eq !== -1) kv[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).trim()
        }

        sock.off('data', onData)
        sock.destroy()

        if (!kv['GAMEHOST'] || !kv['KEY']) {
          reject(new Error(`Missing GAMEHOST or KEY. Got: ${JSON.stringify(kv)}`))
          return
        }

        log(`Game server: ${kv['GAMEHOST']}:${kv['GAMEPORT']}`)
        resolve({
          host: kv['GAMEHOST'],
          port: parseInt(kv['GAMEPORT'] ?? '4901', 10),
          key:  kv['KEY'],
        })
      }
    }

    sock.on('data', onData)
    log(`→ L\\t${charId}\\tSTORM`)
    sock.write(`L\t${charId}\tSTORM\n`, 'latin1')
  })
}

function hashPassword(password: string, hashKey: string): string {
  let out = ''
  for (let i = 0; i < password.length; i++) {
    const p = password.charCodeAt(i)
    const k = hashKey.charCodeAt(i % hashKey.length)
    out += String.fromCharCode(((p - 0x20) ^ k) + 0x20)
  }
  return out
}
