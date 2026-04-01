import { createCache } from './cache'

describe('createCache', () => {
  it('stores and retrieves values', () => {
    const cache = createCache()
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('returns undefined for missing keys', () => {
    const cache = createCache()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('expires values after TTL', async () => {
    const cache = createCache(10)
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')

    await new Promise((r) => setTimeout(r, 20))
    expect(cache.get('key')).toBeUndefined()
  })

  it('deletes values', () => {
    const cache = createCache()
    cache.set('key', 'value')
    cache.delete('key')
    expect(cache.get('key')).toBeUndefined()
  })

  it('clears all values', () => {
    const cache = createCache()
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size()).toBe(0)
  })

  it('reports size', () => {
    const cache = createCache()
    expect(cache.size()).toBe(0)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.size()).toBe(2)
  })

  it('handles complex values', () => {
    const cache = createCache()
    const obj = { foo: 'bar', num: 42 }
    cache.set('obj', obj)
    expect(cache.get<typeof obj>('obj')).toEqual(obj)
  })
})
