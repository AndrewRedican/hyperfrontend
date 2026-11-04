import type { RateLimit } from './fetch'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { FetchFailure, NO_RATE, fetchConditional } from './fetch'

/** One response the page holds. */
export interface CacheEntry<Value> {
  /** The parsed body */
  value: Value
  /** The entity tag it came with, or null */
  etag: string | null
  /** When it was fetched, or last confirmed unchanged, epoch milliseconds */
  fetchedAt: number
}

/** How a read is made. */
export interface ReadOptions {
  /** How old a held copy may be before it is read again, in milliseconds */
  maxAgeMs: number
  /** The reader's token, or null */
  token?: string | null
  /** Whether the copy is also kept in the browser's storage, for the next visit */
  persist?: boolean
}

/** Where persisted copies are kept, in the reader's own browser. */
export const CACHE_STORAGE_PREFIX = 'hyperfrontend-ci:'

/** Called when the rate limit changes. */
type RateListener = () => void

/** The copies held, by address. */
const entries = createMap<string, CacheEntry<unknown>>()

/** The requests under way, by address, so two readers of one address share one request. */
const inflight = createMap<string, Promise<CacheEntry<unknown>>>()

/** Who is told when the rate limit changes. */
const listeners = createSet<RateListener>()

/** The rate limit the latest API response reported. */
let rate: RateLimit = NO_RATE

/**
 * The rate limit the latest API response reported.
 *
 * @returns The limit, the requests left and when they renew, each null until a response says
 */
export function rateLimit(): RateLimit {
  return rate
}

/**
 * Subscribes to the rate limit.
 *
 * @param listener - Called when a response reports a new rate limit
 * @returns Unsubscribes
 */
export function subscribeRate(listener: RateListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Keeps the rate limit a response reported, when it reported one.
 *
 * @param reported - The rate limit
 */
function noteRate(reported: RateLimit): void {
  if (reported.limit === null && reported.remaining === null) return
  rate = reported
  for (const listener of listeners) listener()
}

/**
 * The copy of an address the browser's storage holds.
 *
 * @param url - The address
 * @returns The copy, or null when there is none or storage is unavailable
 */
function restore<Value>(url: string): CacheEntry<Value> | null {
  try {
    const text = window.localStorage.getItem(`${CACHE_STORAGE_PREFIX}${url}`)
    return text === null ? null : (parse(text) as CacheEntry<Value>)
  } catch {
    return null
  }
}

/**
 * Keeps a copy in the browser's storage.
 *
 * @param url - The address
 * @param entry - The copy
 */
function persist(url: string, entry: CacheEntry<unknown>): void {
  try {
    window.localStorage.setItem(`${CACHE_STORAGE_PREFIX}${url}`, stringify(entry))
  } catch {
    // why: storage can be blocked or full; the copy then lives for the page alone
  }
}

/**
 * The copy of an address the page holds, however old.
 *
 * @param url - The address
 * @returns The copy, or null
 */
export function peekCached<Value>(url: string): CacheEntry<Value> | null {
  const held = entries.get(url) as CacheEntry<Value> | undefined
  if (held !== undefined) return held
  const restored = restore<Value>(url)
  if (restored !== null) entries.set(url, restored)
  return restored
}

/**
 * Reads an address: the held copy when it is young enough, else one request shared by every
 * reader asking meanwhile, conditional on the held copy's entity tag so an unchanged answer costs
 * no download. The request is never aborted, since another reader may be waiting on it; a reader
 * that no longer cares ignores the answer.
 *
 * @param url - The address
 * @param options - How old a copy may be, the token and whether to persist
 * @returns The copy
 * @throws {FetchFailure} When the request fails and no copy is held
 */
export async function readCached<Value>(url: string, options: ReadOptions): Promise<CacheEntry<Value>> {
  const held = peekCached<Value>(url)
  if (held !== null && dateNow() - held.fetchedAt < options.maxAgeMs) return held
  const pending = inflight.get(url) as Promise<CacheEntry<Value>> | undefined
  if (pending !== undefined) return pending
  const request = (async (): Promise<CacheEntry<Value>> => {
    try {
      const fetched = await fetchConditional<Value>(url, { token: options.token, etag: held?.etag ?? null })
      noteRate(fetched.rate)
      const entry: CacheEntry<Value> =
        fetched.value === null && held !== null
          ? { ...held, fetchedAt: dateNow() }
          : { value: fetched.value as Value, etag: fetched.etag, fetchedAt: dateNow() }
      entries.set(url, entry)
      if (options.persist === true) persist(url, entry)
      return entry
    } catch (error) {
      if (error instanceof FetchFailure) noteRate(error.rate)
      if (held !== null) return held
      throw error
    } finally {
      inflight.delete(url)
    }
  })()
  inflight.set(url, request as Promise<CacheEntry<unknown>>)
  return request
}

/**
 * Forgets every copy and the rate limit, for a test.
 */
export function clearCache(): void {
  entries.clear()
  inflight.clear()
  rate = NO_RATE
}
