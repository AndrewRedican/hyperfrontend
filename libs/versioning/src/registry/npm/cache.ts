import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/**
 * Cache entry with data and expiration time.
 */
export interface CacheEntry<T> {
  /** Cached data */
  readonly data: T

  /** Timestamp when entry was created */
  readonly timestamp: number
}

/**
 * Simple in-memory cache with TTL support.
 */
export interface Cache {
  /**
   * Get a value from the cache.
   *
   * @param key - Cache key
   * @returns The cached value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined

  /**
   * Set a value in the cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  set<T>(key: string, value: T): void

  /**
   * Delete a value from the cache.
   *
   * @param key - Cache key
   */
  delete(key: string): void

  /**
   * Clear all cached values.
   */
  clear(): void

  /**
   * Get the number of cached entries.
   */
  size(): number
}

/**
 * Creates a new cache instance.
 *
 * @param ttl - Time-to-live in milliseconds (default: 60000 = 1 minute)
 * @returns A new Cache instance
 */
export function createCache(ttl = 60000): Cache {
  const entries = createMap<string, CacheEntry<unknown>>()

  return {
    get<T>(key: string): T | undefined {
      const entry = entries.get(key)
      if (!entry) return undefined

      const now = dateNow()
      if (now - entry.timestamp > ttl) {
        entries.delete(key)
        return undefined
      }

      return <T>entry.data
    },

    set<T>(key: string, value: T): void {
      entries.set(key, { data: value, timestamp: dateNow() })
    },

    delete(key: string): void {
      entries.delete(key)
    },

    clear(): void {
      entries.clear()
    },

    size(): number {
      return entries.size
    },
  }
}
