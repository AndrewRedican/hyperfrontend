import { abs, round, trunc } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * A duration as a reader sees it.
 *
 * @param ms - Milliseconds
 * @returns `1h 18m`, `18m 17s`, `47s` or `0.8s`
 */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 10) return `${round(seconds * 10) / 10}s`
  if (seconds < 60) return `${round(seconds)}s`
  const minutes = trunc(seconds / 60)
  if (minutes < 60) return `${minutes}m ${round(seconds - minutes * 60)}s`
  const hours = trunc(minutes / 60)
  return `${hours}h ${minutes - hours * 60}m`
}

/**
 * An offset on a time axis, as short as it can be.
 *
 * @param ms - Milliseconds from the start
 * @returns `0s`, `45s`, `15m`, `15m 30s`, `1h` or `1h 10m`
 */
export function formatTick(ms: number): string {
  const seconds = round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = trunc(seconds / 60)
  const rest = seconds - minutes * 60
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
  const hours = trunc(minutes / 60)
  return minutes - hours * 60 === 0 ? `${hours}h` : `${hours}h ${minutes - hours * 60}m`
}

/**
 * A short form of a commit.
 *
 * @param sha - The commit
 * @returns Its first seven characters
 */
export function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

/**
 * A time as a reader sees it, in their own zone.
 *
 * @param epochMs - Epoch milliseconds
 * @returns The date and the time
 */
export function formatWhen(epochMs: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(epochMs)
}

/**
 * A time of day to the second.
 *
 * @param epochMs - The time
 * @returns The time, in the reader's locale
 */
export function formatClock(epochMs: number): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(epochMs)
}

/**
 * How long ago, or how far ahead, a time is.
 *
 * @param epochMs - The time
 * @param now - The current time
 * @returns `just now`, `3 min ago`, `in 2 min`, `2 h ago` or `5 d ago`
 */
export function formatAgo(epochMs: number, now: number): string {
  const delta = now - epochMs
  const seconds = abs(delta) / 1000
  const wording = (amount: number, unit: string): string => (delta >= 0 ? `${amount} ${unit} ago` : `in ${amount} ${unit}`)
  if (seconds < 45) return delta >= 0 ? 'just now' : 'in a moment'
  if (seconds < 3_600) return wording(round(seconds / 60), 'min')
  if (seconds < 86_400) return wording(round(seconds / 3_600), 'h')
  return wording(round(seconds / 86_400), 'd')
}

/**
 * A countdown to a time.
 *
 * @param epochMs - The time
 * @param now - The current time
 * @returns `m:ss`
 */
export function formatCountdown(epochMs: number, now: number): string {
  const seconds = trunc((epochMs - now) / 1000)
  if (seconds <= 0) return '0:00'
  const minutes = trunc(seconds / 60)
  return `${minutes}:${`${seconds - minutes * 60}`.padStart(2, '0')}`
}
