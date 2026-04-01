import type { Cache } from './cache'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createCache, clearAllCaches, getCacheCount, unregisterCache, memoize } from './cache'

describe('core/cache', () => {
  const testCaches: Cache<unknown, unknown>[] = []

  afterEach(() => {
    clearAllCaches()
    for (const cache of testCaches) {
      unregisterCache(cache)
    }
    testCaches.length = 0
  })

  describe('createCache', () => {
    describe('basic operations', () => {
      it('stores and retrieves values', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('answer', 42)
        expect(cache.get('answer')).toBe(42)
      })

      it('returns undefined for missing keys', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        expect(cache.get('missing')).toBeUndefined()
      })

      it('overwrites existing values', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('key', 1)
        cache.set('key', 2)
        expect(cache.get('key')).toBe(2)
      })

      it('reports correct size', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        expect(cache.size()).toBe(0)
        cache.set('a', 1)
        expect(cache.size()).toBe(1)
        cache.set('b', 2)
        expect(cache.size()).toBe(2)
        cache.set('a', 3)
        expect(cache.size()).toBe(2)
      })

      it('checks if key exists with has()', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        expect(cache.has('key')).toBe(false)
        cache.set('key', 42)
        expect(cache.has('key')).toBe(true)
      })

      it('deletes entries', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('key', 42)
        expect(cache.delete('key')).toBe(true)
        expect(cache.get('key')).toBeUndefined()
        expect(cache.delete('key')).toBe(false)
      })

      it('clears all entries', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        cache.clear()

        expect(cache.size()).toBe(0)
        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBeUndefined()
        expect(cache.get('c')).toBeUndefined()
      })

      it('returns all keys', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        const keys = cache.keys()
        expect(keys).toHaveLength(3)
        expect(keys).toContain('a')
        expect(keys).toContain('b')
        expect(keys).toContain('c')
      })

      it('supports object values', () => {
        const cache = createCache<string, { name: string; value: number }>()
        testCaches.push(cache)

        const obj = { name: 'test', value: 42 }
        cache.set('key', obj)
        expect(cache.get('key')).toEqual(obj)
      })

      it('supports number keys', () => {
        const cache = createCache<number, string>()
        testCaches.push(cache)

        cache.set(1, 'one')
        cache.set(2, 'two')
        expect(cache.get(1)).toBe('one')
        expect(cache.get(2)).toBe('two')
      })
    })

    describe('TTL expiration', () => {
      beforeEach(() => {
        jest.useFakeTimers()
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      it('returns cached value before TTL expires', () => {
        const cache = createCache<string, number>({ ttl: 1000 })
        testCaches.push(cache)

        cache.set('key', 42)

        jest.advanceTimersByTime(500)

        expect(cache.get('key')).toBe(42)
      })

      it('expires cached value after TTL', () => {
        const cache = createCache<string, number>({ ttl: 1000 })
        testCaches.push(cache)

        cache.set('key', 42)

        jest.advanceTimersByTime(1001)

        expect(cache.get('key')).toBeUndefined()
      })

      it('reports expired keys as not existing via has()', () => {
        const cache = createCache<string, number>({ ttl: 1000 })
        testCaches.push(cache)

        cache.set('key', 42)
        expect(cache.has('key')).toBe(true)

        jest.advanceTimersByTime(1001)
        expect(cache.has('key')).toBe(false)
      })

      it('refreshes TTL on update', () => {
        const cache = createCache<string, number>({ ttl: 1000 })
        testCaches.push(cache)

        cache.set('key', 1)
        jest.advanceTimersByTime(800)

        cache.set('key', 2)

        jest.advanceTimersByTime(500)

        expect(cache.get('key')).toBe(2)
      })

      it('handles multiple entries with different expiration times', () => {
        const cache = createCache<string, number>({ ttl: 1000 })
        testCaches.push(cache)

        cache.set('first', 1)

        jest.advanceTimersByTime(500)
        cache.set('second', 2)

        jest.advanceTimersByTime(600)

        expect(cache.get('first')).toBeUndefined()
        expect(cache.get('second')).toBe(2)
      })
    })

    describe('max size eviction', () => {
      it('evicts oldest entry when max size is reached', () => {
        const cache = createCache<string, number>({ maxSize: 2 })
        testCaches.push(cache)

        cache.set('first', 1)
        cache.set('second', 2)
        cache.set('third', 3)

        expect(cache.get('first')).toBeUndefined()
        expect(cache.get('second')).toBe(2)
        expect(cache.get('third')).toBe(3)
        expect(cache.size()).toBe(2)
      })

      it('updates do not cause eviction', () => {
        const cache = createCache<string, number>({ maxSize: 2 })
        testCaches.push(cache)

        cache.set('first', 1)
        cache.set('second', 2)
        cache.set('first', 100)

        expect(cache.get('first')).toBe(100)
        expect(cache.get('second')).toBe(2)
        expect(cache.size()).toBe(2)
      })

      it('evicts multiple entries when needed', () => {
        const cache = createCache<string, number>({ maxSize: 2 })
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)

        cache.set('c', 3)
        cache.set('d', 4)

        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBeUndefined()
        expect(cache.get('c')).toBe(3)
        expect(cache.get('d')).toBe(4)
      })

      it('handles maxSize of 1', () => {
        const cache = createCache<string, number>({ maxSize: 1 })
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        expect(cache.size()).toBe(1)
        expect(cache.get('c')).toBe(3)
        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBeUndefined()
      })
    })

    describe('combined TTL and maxSize', () => {
      beforeEach(() => {
        jest.useFakeTimers()
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      it('applies both TTL and maxSize constraints', () => {
        const cache = createCache<string, number>({ ttl: 1000, maxSize: 2 })
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)

        jest.advanceTimersByTime(500)
        cache.set('c', 3)

        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBe(2)
        expect(cache.get('c')).toBe(3)

        jest.advanceTimersByTime(600)

        expect(cache.get('b')).toBeUndefined()
        expect(cache.get('c')).toBe(3)
      })
    })
  })

  describe('clearAllCaches', () => {
    it('clears all registered caches', () => {
      const cache1 = createCache<string, number>()
      const cache2 = createCache<string, string>()
      testCaches.push(cache1, cache2)

      cache1.set('a', 1)
      cache2.set('b', 'two')

      clearAllCaches()

      expect(cache1.get('a')).toBeUndefined()
      expect(cache2.get('b')).toBeUndefined()
      expect(cache1.size()).toBe(0)
      expect(cache2.size()).toBe(0)
    })
  })

  describe('getCacheCount', () => {
    it('returns the number of registered caches', () => {
      const initialCount = getCacheCount()

      const cache1 = createCache<string, number>()
      const cache2 = createCache<string, number>()
      testCaches.push(cache1, cache2)

      expect(getCacheCount()).toBe(initialCount + 2)
    })
  })

  describe('unregisterCache', () => {
    it('removes cache from registry', () => {
      const initialCount = getCacheCount()

      const cache = createCache<string, number>()
      expect(getCacheCount()).toBe(initialCount + 1)

      expect(unregisterCache(cache)).toBe(true)
      expect(getCacheCount()).toBe(initialCount)
    })

    it('returns false for already unregistered cache', () => {
      const cache = createCache<string, number>()
      unregisterCache(cache)
      expect(unregisterCache(cache)).toBe(false)
    })
  })

  describe('memoize', () => {
    it('caches function results', () => {
      let callCount = 0
      const expensive = (key: string): number => {
        callCount++
        return key.length
      }

      const memoized = memoize(expensive)
      // Note: memoize creates its own cache, we need to unregister it manually
      testCaches.push(memoized.cache)

      expect(memoized('hello')).toBe(5)
      expect(memoized('hello')).toBe(5)
      expect(memoized('hello')).toBe(5)

      expect(callCount).toBe(1)
    })

    it('caches different keys separately', () => {
      let callCount = 0
      const expensive = (key: string): number => {
        callCount++
        return key.length
      }

      const memoized = memoize(expensive)
      testCaches.push(memoized.cache)

      expect(memoized('a')).toBe(1)
      expect(memoized('bb')).toBe(2)
      expect(memoized('ccc')).toBe(3)

      expect(callCount).toBe(3)

      expect(memoized('a')).toBe(1)
      expect(memoized('bb')).toBe(2)
      expect(memoized('ccc')).toBe(3)

      expect(callCount).toBe(3)
    })

    it('exposes cache for direct manipulation', () => {
      const memoized = memoize((key: string) => key.toUpperCase())
      testCaches.push(memoized.cache)

      memoized('test')
      expect(memoized.cache.has('test')).toBe(true)

      memoized.cache.clear()
      expect(memoized.cache.has('test')).toBe(false)
    })

    it('respects TTL option', () => {
      jest.useFakeTimers()

      let callCount = 0
      const memoized = memoize(
        (key: string) => {
          callCount++
          return key.length
        },
        { ttl: 1000 }
      )
      testCaches.push(memoized.cache)

      memoized('test')
      expect(callCount).toBe(1)

      memoized('test')
      expect(callCount).toBe(1)

      jest.advanceTimersByTime(1001)

      memoized('test')
      expect(callCount).toBe(2)

      jest.useRealTimers()
    })

    it('respects maxSize option', () => {
      let callCount = 0
      const memoized = memoize(
        (key: string) => {
          callCount++
          return key.length
        },
        { maxSize: 2 }
      )
      testCaches.push(memoized.cache)

      memoized('a')
      memoized('bb')
      memoized('ccc')

      expect(callCount).toBe(3)

      memoized('a')
      expect(callCount).toBe(4)

      memoized('ccc')
      expect(callCount).toBe(4)
    })
  })
})
