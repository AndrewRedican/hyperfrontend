import type { ConsentStorage } from './consent'
import { describe, expect, it, vi } from 'vitest'
import { CONSENT_STORAGE_KEY, createConsentStore, parseStoredConsent } from './consent'

/**
 * An in-memory localStorage stand-in.
 *
 * @param initial - Seed entries.
 * @returns The storage backend plus its backing map.
 */
function createMemoryStorage(initial: Record<string, string> = {}): ConsentStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

/**
 * A fixed clock for deterministic decidedAt stamps.
 *
 * @returns The pinned ISO timestamp.
 */
const clock = () => '2026-08-05T00:00:00.000Z'

describe('parseStoredConsent', () => {
  it('round-trips a valid stored value', () => {
    const raw = '{"version":1,"analytics":true,"advertising":false,"decidedAt":"2026-08-05T00:00:00.000Z"}'
    expect(parseStoredConsent(raw)).toEqual({ version: 1, analytics: true, advertising: false, decidedAt: '2026-08-05T00:00:00.000Z' })
  })

  it('rejects malformed json', () => {
    expect(parseStoredConsent('{nope')).toBeNull()
  })

  it('rejects a wrong schema version', () => {
    expect(parseStoredConsent('{"version":2,"analytics":true,"advertising":true,"decidedAt":"x"}')).toBeNull()
  })

  it('rejects missing fields', () => {
    expect(parseStoredConsent('{"version":1,"analytics":true}')).toBeNull()
  })
})

describe('createConsentStore', () => {
  it('starts with no decision', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    expect(store.hasDecision()).toBe(false)
  })

  it('denies optional categories before any decision', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    expect([store.isGranted('analytics'), store.isGranted('advertising')]).toEqual([false, false])
  })

  it('always grants the necessary category', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    expect(store.isGranted('necessary')).toBe(true)
  })

  it('records and persists a decision', () => {
    const storage = createMemoryStorage()
    const store = createConsentStore(storage, clock)
    store.decide({ analytics: true, advertising: false })
    expect(parseStoredConsent(storage.getItem(CONSENT_STORAGE_KEY))).toEqual(
      expect.objectContaining({ analytics: true, advertising: false })
    )
  })

  it('rehydrates a persisted decision', () => {
    const storage = createMemoryStorage()
    createConsentStore(storage, clock).decide({ analytics: false, advertising: true })
    const rehydrated = createConsentStore(storage, clock)
    expect([rehydrated.isGranted('analytics'), rehydrated.isGranted('advertising')]).toEqual([false, true])
  })

  it('analytics-only consent does not grant advertising', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    store.decide({ analytics: true, advertising: false })
    expect(store.isGranted('advertising')).toBe(false)
  })

  it('withdrawal denies both optional categories while keeping the decision', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    store.decide({ analytics: true, advertising: true })
    store.withdrawOptional()
    expect([store.hasDecision(), store.isGranted('analytics'), store.isGranted('advertising')]).toEqual([true, false, false])
  })

  it('notifies subscribers on every decision', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    const listener = vi.fn<() => void>()
    store.subscribe(listener)
    store.decide({ analytics: true, advertising: true })
    store.withdrawOptional()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('an unsubscribed listener hears nothing further', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    const listener = vi.fn<() => void>()
    store.subscribe(listener)()
    store.decide({ analytics: true, advertising: true })
    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores corrupt persisted values', () => {
    const storage = createMemoryStorage({ [CONSENT_STORAGE_KEY]: '{broken' })
    expect(createConsentStore(storage, clock).hasDecision()).toBe(false)
  })

  it('works without any storage backend', () => {
    const store = createConsentStore(null, clock)
    store.decide({ analytics: true, advertising: false })
    expect(store.isGranted('analytics')).toBe(true)
  })

  it('survives a storage backend that throws on write', () => {
    const storage = createMemoryStorage()
    storage.setItem = () => {
      throw new Error('quota exceeded')
    }
    const store = createConsentStore(storage, clock)
    store.decide({ analytics: true, advertising: true })
    expect(store.isGranted('analytics')).toBe(true)
  })

  it('stamps the decision time', () => {
    const store = createConsentStore(createMemoryStorage(), clock)
    expect(store.decide({ analytics: false, advertising: false }).decidedAt).toBe('2026-08-05T00:00:00.000Z')
  })
})
