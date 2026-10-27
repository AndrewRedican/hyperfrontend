import type { RateLimit } from './fetch'
import { ceil, max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { LIVE_POLL_MS } from './sources'

/** The most check runs GitHub returns on one page. */
export const CHECK_RUNS_PER_PAGE = 100

/** The requests an hour GitHub answers a browser without a token, assumed when a response does not say. */
const ANONYMOUS_LIMIT = 60

/** The window GitHub counts its rate limit over, in milliseconds. */
const HOUR_MS = 3_600_000

/** When a followed run is read next, and the pace behind it. */
export interface PollPace {
  /** When the next read starts, in epoch milliseconds */
  at: number
  /** The interval that fits reads of this size into the hourly limit, in milliseconds */
  everyMs: number
  /** The requests the last read made */
  requests: number
  /** The requests GitHub allows in the hour */
  limit: number
  /** Whether the next read waits for GitHub to renew the hour's requests */
  waitsForReset: boolean
}

/**
 * The pages of a commit's check runs left to read once the first page has reported their total.
 *
 * @param totalCount - The total the first page reported
 * @returns The page numbers, from 2, that hold the rest
 */
export function laterPages(totalCount: number): number[] {
  const pages: number[] = []
  for (let page = 2; (page - 1) * CHECK_RUNS_PER_PAGE < totalCount; page += 1) pages.push(page)
  return pages
}

/**
 * When to read a followed run again: reads the size of the last one, spread to fit the hourly limit but never closer than
 * {@link LIVE_POLL_MS}, and no sooner than GitHub renews the hour's requests when those left cannot cover another read.
 *
 * @param requests - The requests the last read made
 * @param rate - The rate limit the latest response reported
 * @param now - The current time, in epoch milliseconds
 * @returns The next read's time and the pace behind it
 */
export function pollPace(requests: number, rate: RateLimit, now: number): PollPace {
  const limit = rate.limit ?? ANONYMOUS_LIMIT
  const everyMs = max(LIVE_POLL_MS, ceil((HOUR_MS * requests) / limit))
  const resetAt = rate.remaining !== null && rate.remaining < requests ? rate.resetAt : null
  return { at: now + max(everyMs, resetAt === null ? 0 : resetAt - now), everyMs, requests, limit, waitsForReset: resetAt !== null }
}
