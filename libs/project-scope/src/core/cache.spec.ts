import type { Cache } from './cache'
import { beforeEach, afterEach } from 'node:test'
import { describe, it, expect, jest } from '@hyperfrontend/testing'
import { createCache, clearAllCaches, getCacheCount, unregisterCache, memoize } from './cache'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/date', () => ({
  ...jest.requireActual<object>('@hyperfrontend/immutable-api-utils/built-in-copy/date'),
  dateNow: () => Date.now(),
}))

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

        const sizes = [cache.size()]
        cache.set('a', 1)
        sizes.push(cache.size())
        cache.set('b', 2)
        sizes.push(cache.size())
        cache.set('a', 3)
        sizes.push(cache.size())
        expect(sizes).toEqual([0, 1, 2, 2])
      })

      it('reports a missing key as absent via has()', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        expect(cache.has('key')).toBe(false)
      })

      it('reports a stored key as present via has()', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('key', 42)
        expect(cache.has('key')).toBe(true)
      })

      it('reports a successful delete', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('key', 42)
        expect(cache.delete('key')).toBe(true)
      })

      it('forgets a deleted entry', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('key', 42)
        cache.delete('key')
        expect(cache.get('key')).toBeUndefined()
      })

      it('reports a repeated delete as a miss', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('key', 42)
        cache.delete('key')
        expect(cache.delete('key')).toBe(false)
      })

      it('clears all entries', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        cache.clear()

        expect({ size: cache.size(), values: ['a', 'b', 'c'].map((key) => cache.get(key)) }).toEqual({
          size: 0,
          values: [undefined, undefined, undefined],
        })
      })

      it('returns all keys in insertion order', () => {
        const cache = createCache<string, number>()
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        expect(cache.keys()).toEqual(['a', 'b', 'c'])
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
        expect([cache.get(1), cache.get(2)]).toEqual(['one', 'two'])
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
        const presentBeforeExpiry = cache.has('key')

        jest.advanceTimersByTime(1001)
        expect([presentBeforeExpiry, cache.has('key')]).toEqual([true, false])
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

        expect([cache.get('first'), cache.get('second')]).toEqual([undefined, 2])
      })
    })

    describe('max size eviction', () => {
      it('evicts oldest entry when max size is reached', () => {
        const cache = createCache<string, number>({ maxSize: 2 })
        testCaches.push(cache)

        cache.set('first', 1)
        cache.set('second', 2)
        cache.set('third', 3)

        expect({ values: ['first', 'second', 'third'].map((key) => cache.get(key)), size: cache.size() }).toEqual({
          values: [undefined, 2, 3],
          size: 2,
        })
      })

      it('updates do not cause eviction', () => {
        const cache = createCache<string, number>({ maxSize: 2 })
        testCaches.push(cache)

        cache.set('first', 1)
        cache.set('second', 2)
        cache.set('first', 100)

        expect({ values: ['first', 'second'].map((key) => cache.get(key)), size: cache.size() }).toEqual({
          values: [100, 2],
          size: 2,
        })
      })

      it('evicts multiple entries when needed', () => {
        const cache = createCache<string, number>({ maxSize: 2 })
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)

        cache.set('c', 3)
        cache.set('d', 4)

        expect(['a', 'b', 'c', 'd'].map((key) => cache.get(key))).toEqual([undefined, undefined, 3, 4])
      })

      it('handles maxSize of 1', () => {
        const cache = createCache<string, number>({ maxSize: 1 })
        testCaches.push(cache)

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        expect({ size: cache.size(), values: ['a', 'b', 'c'].map((key) => cache.get(key)) }).toEqual({
          size: 1,
          values: [undefined, undefined, 3],
        })
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
        const afterEviction = ['a', 'b', 'c'].map((key) => cache.get(key))

        jest.advanceTimersByTime(600)
        const afterExpiry = ['b', 'c'].map((key) => cache.get(key))

        expect({ afterEviction, afterExpiry }).toEqual({ afterEviction: [undefined, 2, 3], afterExpiry: [undefined, 3] })
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

      expect({ values: [cache1.get('a'), cache2.get('b')], sizes: [cache1.size(), cache2.size()] }).toEqual({
        values: [undefined, undefined],
        sizes: [0, 0],
      })
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
      const countAfterCreate = getCacheCount()
      const removed = unregisterCache(cache)

      expect({ countAfterCreate, removed, countAfterRemove: getCacheCount() }).toEqual({
        countAfterCreate: initialCount + 1,
        removed: true,
        countAfterRemove: initialCount,
      })
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

      const results = [memoized('hello'), memoized('hello'), memoized('hello')]

      expect({ results, callCount }).toEqual({ results: [5, 5, 5], callCount: 1 })
    })

    it('caches different keys separately', () => {
      let callCount = 0
      const expensive = (key: string): number => {
        callCount++
        return key.length
      }

      const memoized = memoize(expensive)
      testCaches.push(memoized.cache)

      const firstPass = [memoized('a'), memoized('bb'), memoized('ccc')]
      const callsAfterFirstPass = callCount
      const secondPass = [memoized('a'), memoized('bb'), memoized('ccc')]

      expect({ firstPass, callsAfterFirstPass, secondPass, callsAfterSecondPass: callCount }).toEqual({
        firstPass: [1, 2, 3],
        callsAfterFirstPass: 3,
        secondPass: [1, 2, 3],
        callsAfterSecondPass: 3,
      })
    })

    it('exposes the cache holding memoized keys', () => {
      const memoized = memoize((key: string) => key.toUpperCase())
      testCaches.push(memoized.cache)

      memoized('test')
      expect(memoized.cache.has('test')).toBe(true)
    })

    it('forgets memoized keys when the exposed cache is cleared', () => {
      const memoized = memoize((key: string) => key.toUpperCase())
      testCaches.push(memoized.cache)

      memoized('test')
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
      const callsAfterFirst = callCount

      memoized('test')
      const callsAfterRepeat = callCount

      jest.advanceTimersByTime(1001)

      memoized('test')
      expect([callsAfterFirst, callsAfterRepeat, callCount]).toEqual([1, 1, 2])

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
      const callsAfterFill = callCount

      memoized('a')
      const callsAfterEvictedKey = callCount

      memoized('ccc')
      expect([callsAfterFill, callsAfterEvictedKey, callCount]).toEqual([3, 4, 4])
    })
  })
})
