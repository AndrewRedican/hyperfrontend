import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { isStaleLock, LOCK_FILE, withLock } from './lock'

const directory = useTempDir({ prefix: 'lock-' })

/** A pid no process is likely to hold. */
const DEAD_PID = 1073741823

describe('withLock', () => {
  it('runs the work and answers what it returned', () => {
    expect(withLock(directory.path, () => 42)).toBe(42)
  })

  it('removes the lock after the work', () => {
    withLock(directory.path, () => undefined)
    expect(existsSync(join(directory.path, LOCK_FILE))).toBe(false)
  })

  it('removes the lock when the work throws', () => {
    expect(() =>
      withLock(directory.path, () => {
        throw new Error('work failed')
      })
    ).toThrow('work failed')
  })

  it('leaves no lock behind a throwing work', () => {
    try {
      withLock(directory.path, () => {
        throw new Error('work failed')
      })
    } catch {
      // why: the throw is the point; the lock file is what is checked.
    }
    expect(existsSync(join(directory.path, LOCK_FILE))).toBe(false)
  })

  it('takes over a lock whose holder is dead', () => {
    writeFileSync(join(directory.path, LOCK_FILE), `${DEAD_PID}\n`)
    expect(withLock(directory.path, () => 'taken', { timeoutMs: 500, pollMs: 10 })).toBe('taken')
  })

  it('takes over a lock older than the bound whatever its holder', () => {
    const path = join(directory.path, LOCK_FILE)
    writeFileSync(path, `${process.pid}\n`)
    utimesSync(path, new Date(0), new Date(0))
    expect(withLock(directory.path, () => 'taken', { staleMs: 1000, timeoutMs: 500, pollMs: 10 })).toBe('taken')
  })

  it('gives up on a live lock at the timeout', () => {
    writeFileSync(join(directory.path, LOCK_FILE), `${process.pid}\n`)
    expect(() => withLock(directory.path, () => 'never', { timeoutMs: 60, pollMs: 10 })).toThrow('locked by another process')
  })

  it('holds its pid while the work runs', () => {
    const path = join(directory.path, LOCK_FILE)
    expect(withLock(directory.path, () => readFileSync(path, 'utf8'))).toBe(`${process.pid}\n`)
  })

  it('leaves only the lock in the directory while the work runs', () => {
    expect(withLock(directory.path, () => readdirSync(directory.path))).toEqual([LOCK_FILE])
  })

  it('keeps a lock another writer took after this one was judged stale', () => {
    const path = join(directory.path, LOCK_FILE)
    withLock(directory.path, () => writeFileSync(path, `${DEAD_PID}\n`))
    expect(readFileSync(path, 'utf8')).toBe(`${DEAD_PID}\n`)
  })

  it('tolerates work that removed the lock', () => {
    expect(withLock(directory.path, () => rmSync(join(directory.path, LOCK_FILE)))).toBeUndefined()
  })

  it('waits for a live holder and proceeds once it has released the lock', () => {
    const path = join(directory.path, LOCK_FILE)
    const script = `const fs = require('node:fs'); fs.writeFileSync(${JSON.stringify(path)}, process.pid + '\\n'); setTimeout(() => fs.rmSync(${JSON.stringify(path)}), 300)`
    const holder = spawn(process.execPath, ['-e', script], { stdio: 'ignore', env: { ...process.env, NODE_OPTIONS: '' } })
    holder.unref()
    while (!existsSync(path)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    expect(withLock(directory.path, () => 'eventually', { timeoutMs: 5000, pollMs: 20 })).toBe('eventually')
  })
})

describe('isStaleLock', () => {
  it('counts a missing lock as stale', () => {
    expect(isStaleLock(join(directory.path, 'absent'), 60_000)).toBe(true)
  })

  it('counts a lock that cannot be read as stale', () => {
    const path = join(directory.path, 'unreadable')
    mkdirSync(path)
    expect(isStaleLock(path, 60_000)).toBe(true)
  })

  it('counts a lock holding no pid as stale', () => {
    const path = join(directory.path, LOCK_FILE)
    writeFileSync(path, 'garbage\n')
    expect(isStaleLock(path, 60_000)).toBe(true)
  })

  it('counts a fresh lock of a live process as live', () => {
    const path = join(directory.path, LOCK_FILE)
    writeFileSync(path, `${process.pid}\n`)
    expect(isStaleLock(path, 60_000)).toBe(false)
  })
})
