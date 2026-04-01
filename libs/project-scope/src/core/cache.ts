import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineProperty, freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Cache entry with value and metadata.
 */
interface CacheEntry<V> {
  /** Cached value */
  value: V
  /** Timestamp when entry was created */
  timestamp: number
}

/**
 * Options for cache creation.
 */
export interface CacheOptions {
  /**
   * Time to live in milliseconds.
   * Entries older than this will be considered expired.
   */
  ttl?: number
  /**
   * Maximum number of entries in cache.
   * When exceeded, oldest entries are evicted (FIFO).
   */
  maxSize?: number
}

/**
 * Cache interface for storing key-value pairs with optional TTL and size limits.
 */
export interface Cache<K, V> {
  /**
   * Get a value from the cache.
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: K): V | undefined

  /**
   * Set a value in the cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: K, value: V): void

  /**
   * Check if a key exists in the cache (and is not expired).
   *
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  has(key: K): boolean

  /**
   * Delete a key from the cache.
   *
   * @param key - Cache key
   * @returns True if the key was deleted
   */
  delete(key: K): boolean

  /**
   * Clear all entries from the cache.
   */
  clear(): void

  /**
   * Get the current number of entries in the cache.
   *
   * @returns Number of entries
   */
  size(): number

  /**
   * Get all keys in the cache.
   *
   * @returns Array of keys
   */
  keys(): K[]
}

/**
 * Global registry of all caches for bulk operations.
 */
const cacheRegistry: Set<Cache<unknown, unknown>> = createSet()

/**
 * Create a cache with optional TTL and size limits.
 *
 * The cache provides a simple key-value store with:
 * - Optional TTL (time-to-live) for automatic expiration
 * - Optional maxSize for limiting cache size with FIFO eviction
 * - Lazy expiration (entries are checked on access)
 *
 * @param options - Cache configuration options
 * @returns Cache instance
 *
 * @example
 * ```typescript
 * // Basic cache
 * const cache = createCache<string, number>()
 * cache.set('answer', 42)
 * cache.get('answer') // 42
 *
 * // Cache with TTL (expires after 60 seconds)
 * const ttlCache = createCache<string, object>({ ttl: 60000 })
 *
 * // Cache with max size (evicts oldest when full)
 * const lruCache = createCache<string, object>({ maxSize: 100 })
 *
 * // Combined options
 * const configCache = createCache<string, object>({
 *   ttl: 30000,
 *   maxSize: 50
 * })
 * ```
 */
export function createCache<K, V>(options?: CacheOptions): Cache<K, V> {
  const { ttl, maxSize } = options ?? {}
  const store = createMap<K, CacheEntry<V>>()
  const insertionOrder: K[] = []

  /**
   * Check if an entry is expired.
   *
   * @param entry - Cache entry to check
   * @returns True if entry is expired
   */
  function isExpired(entry: CacheEntry<V>): boolean {
    if (ttl === undefined) return false
    // eslint-disable-next-line workspace/no-unsafe-builtin-methods -- Date.now() is needed for Jest fake timers compatibility
    return Date.now() - entry.timestamp > ttl
  }

  /**
   * Evict oldest entries to make room for new ones.
   */
  function evictIfNeeded(): void {
    if (maxSize === undefined) return
    while (store.size >= maxSize && insertionOrder.length > 0) {
      const oldestKey = insertionOrder.shift()
      if (oldestKey !== undefined) {
        store.delete(oldestKey)
      }
    }
  }

  /**
   * Remove key from insertion order tracking.
   *
   * @param key - Key to remove from order tracking
   */
  function removeFromOrder(key: K): void {
    const index = insertionOrder.indexOf(key)
    if (index !== -1) {
      insertionOrder.splice(index, 1)
    }
  }

  const cache: Cache<K, V> = {
    get(key: K): V | undefined {
      const entry = store.get(key)
      if (!entry) return undefined

      if (isExpired(entry)) {
        store.delete(key)
        removeFromOrder(key)
        return undefined
      }

      return entry.value
    },

    set(key: K, value: V): void {
      if (store.has(key)) {
        removeFromOrder(key)
      } else {
        evictIfNeeded()
      }

      // eslint-disable-next-line workspace/no-unsafe-builtin-methods -- Date.now() is needed for Jest fake timers compatibility
      store.set(key, { value, timestamp: Date.now() })
      insertionOrder.push(key)
    },

    has(key: K): boolean {
      const entry = store.get(key)
      if (!entry) return false

      if (isExpired(entry)) {
        store.delete(key)
        removeFromOrder(key)
        return false
      }

      return true
    },

    delete(key: K): boolean {
      removeFromOrder(key)
      return store.delete(key)
    },

    clear(): void {
      store.clear()
      insertionOrder.length = 0
    },

    size(): number {
      return store.size
    },

    keys(): K[] {
      return [...insertionOrder]
    },
  }

  cacheRegistry.add(<Cache<unknown, unknown>>cache)

  return freeze(cache)
}

/**
 * Clear all registered caches.
 *
 * Useful for testing or when a global state reset is needed.
 * This clears all caches created via `createCache()`.
 *
 * @example
 * ```typescript
 * // In tests
 * afterEach(() => {
 *   clearAllCaches()
 * })
 * ```
 */
export function clearAllCaches(): void {
  for (const cache of cacheRegistry) {
    cache.clear()
  }
}

/**
 * Get the number of registered caches.
 *
 * Primarily used for testing.
 *
 * @returns Number of registered caches
 */
export function getCacheCount(): number {
  return cacheRegistry.size
}

/**
 * Unregister a cache from the global registry.
 *
 * Useful for cleanup in tests or when a cache is no longer needed.
 *
 * @param cache - Cache to unregister
 * @returns True if cache was unregistered
 */
export function unregisterCache<K, V>(cache: Cache<K, V>): boolean {
  return cacheRegistry.delete(<Cache<unknown, unknown>>cache)
}

/**
 * Create a memoized version of a function with caching.
 *
 * The memoized function caches results based on the first argument (key).
 * If additional arguments are needed, use the options.keyFn parameter.
 *
 * @param fn - Function to memoize
 * @param options - Cache options for the underlying cache
 * @returns Memoized function with cache control methods
 *
 * @example
 * ```typescript
 * // Memoize a detection function
 * const detectTechStackMemo = memoize(
 *   (path: string) => expensiveDetection(path),
 *   { ttl: 60000 }
 * )
 *
 * const result1 = detectTechStackMemo('/path/to/project')
 * const result2 = detectTechStackMemo('/path/to/project') // Returns cached
 *
 * // Clear the cache
 * detectTechStackMemo.cache.clear()
 * ```
 */
export function memoize<K, V>(fn: (key: K) => V, options?: CacheOptions): ((key: K) => V) & { cache: Cache<K, V> } {
  const cache = createCache<K, V>(options)

  const memoized = (key: K): V => {
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }

    const result = fn(key)
    cache.set(key, result)
    return result
  }

  defineProperty(memoized, 'cache', {
    value: cache,
    writable: false,
    enumerable: true,
  })

  return <((key: K) => V) & { cache: Cache<K, V> }>memoized
}
