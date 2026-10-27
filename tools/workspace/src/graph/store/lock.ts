/**
 * The lock one writer of the state directory holds: a file that appears already holding the
 * writer's pid, stale once its writer is dead or it has outlived a bound, so a crashed build never
 * blocks the next one; a second writer waits for it, then proceeds. A lock is removed only while it
 * still holds the pid that was judged, so a writer never deletes its successor's lock.
 *
 * @module graph/store/lock
 */

import { linkSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isFinite, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { construct } from '@hyperfrontend/immutable-api-utils/built-in-copy/reflect'
import { createSharedArrayBuffer } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/** How a lock is taken. */
export interface LockOptions {
  /** After how many milliseconds a lock counts as stale whatever its holder, 60 s by default. */
  readonly staleMs?: number
  /** How long to wait for a live lock before giving up, 60 s by default. */
  readonly timeoutMs?: number
  /** How long to pause between attempts, 50 ms by default. */
  readonly pollMs?: number
}

/** The lock file's name within the state directory. */
export const LOCK_FILE = '.lock'

/**
 * Whether a process is alive.
 *
 * @param pid - The process id
 * @returns True when a signal can be sent to it
 */
function isAlive(pid: number): boolean {
  if (!isFinite(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * What a lock file holds, or null when it is gone.
 *
 * @param path - The lock file
 * @returns Its text, or null when it vanished
 */
function readHolder(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * The holder of a lock that no longer protects anything: the lock is gone, older than the bound,
 * or held by a process that is not running.
 *
 * @param path - The lock file
 * @param staleMs - The bound on its age, in milliseconds
 * @returns The text the stale lock held (null when it is gone), or undefined while it is live
 */
function staleHolder(path: string, staleMs: number): string | null | undefined {
  const stats = statSync(path, { throwIfNoEntry: false })
  if (stats === undefined) return null
  const holder = readHolder(path)
  if (holder === null || dateNow() - stats.mtimeMs > staleMs) return holder
  return isAlive(parseInt(holder, 10)) ? undefined : holder
}

/**
 * Whether a lock file no longer protects anything: it is gone, older than the bound, or held by a
 * process that is not running.
 *
 * @param path - The lock file
 * @param staleMs - The bound on its age, in milliseconds
 * @returns True when the lock may be removed
 */
export function isStaleLock(path: string, staleMs: number): boolean {
  return staleHolder(path, staleMs) !== undefined
}

/**
 * Removes a lock if it still holds the given text, so a successor's lock taken since is kept.
 *
 * @param path - The lock file
 * @param holder - The text it held when it was judged, null when it was already gone
 */
function removeHeldBy(path: string, holder: string | null): void {
  if (readHolder(path) === holder) rmSync(path, { force: true })
}

/**
 * Pauses the thread.
 *
 * @param ms - How long, in milliseconds
 */
function pause(ms: number): void {
  Atomics.wait(construct(Int32Array, [createSharedArrayBuffer(4)]) as Int32Array, 0, 0, ms)
}

/**
 * Takes the lock exclusively, if nobody holds it: the pid is written to a file of this process's
 * own and linked into place, so the lock never exists without its holder.
 *
 * @param path - The lock file
 * @param holder - The text the lock holds
 * @returns True when this process now holds the lock
 */
function tryLock(path: string, holder: string): boolean {
  const own = `${path}.${process.pid}`
  writeFileSync(own, holder)
  let taken = true
  try {
    linkSync(own, path)
  } catch {
    taken = false
  }
  rmSync(own, { force: true })
  return taken
}

/**
 * Runs work while holding the directory's lock, taken over from a stale holder and waited for
 * from a live one; the lock is released whether the work returns or throws.
 *
 * @param directory - The state directory, created when absent
 * @param work - The work run while the lock is held
 * @param options - The staleness bound, the wait and the poll interval
 * @returns What the work returned
 */
export function withLock<Result>(directory: string, work: () => Result, options: LockOptions = {}): Result {
  const { staleMs = 60_000, timeoutMs = 60_000, pollMs = 50 } = options
  mkdirSync(directory, { recursive: true })
  const path = join(directory, LOCK_FILE)
  const deadline = dateNow() + timeoutMs
  const own = `${process.pid}\n`
  while (!tryLock(path, own)) {
    const stale = staleHolder(path, staleMs)
    if (stale !== undefined) removeHeldBy(path, stale)
    else if (dateNow() >= deadline) throw createError(`the graph state at ${directory} is locked by another process`)
    else pause(pollMs)
  }
  try {
    return work()
  } finally {
    removeHeldBy(path, own)
  }
}
