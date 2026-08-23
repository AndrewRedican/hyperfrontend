/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { measureOwnMemory, originRelation } from '../browsing-context.js'

/** The directory the entries of this frame are attributed to. */
const OWN = 'https://koi.test/fish-vanilla/'

/**
 * Puts a value behind a property the test document does not carry itself.
 *
 * @param target - The object to define it on.
 * @param key - The property name.
 * @param value - What reading it hands back.
 */
function pretend(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, value })
}

/**
 * Answers a memory measurement with a breakdown of the caller's choosing.
 *
 * @param breakdown - The entries the browser is pretending to attribute.
 */
function measures(breakdown: Array<{ bytes: number; attribution: Array<{ url?: string }> }>): void {
  pretend(window, 'crossOriginIsolated', true)
  pretend(performance, 'measureUserAgentSpecificMemory', () => Promise.resolve({ breakdown }))
}

afterEach(() => {
  Reflect.deleteProperty(window, 'crossOriginIsolated')
  Reflect.deleteProperty(performance, 'measureUserAgentSpecificMemory')
  Reflect.deleteProperty(document, 'referrer')
})

describe('originRelation', () => {
  it('reports nothing embedding an app nothing embeds', () => {
    expect(originRelation(false)).toBe(null)
  })

  it('reads an embedding page served from the same origin as this app as that origin', () => {
    pretend(document, 'referrer', `${window.location.origin}/pond/`)
    expect(originRelation(true)).toBe('same-origin')
  })

  it('reads an embedding page served from elsewhere as another origin', () => {
    pretend(document, 'referrer', 'https://pond.test/')
    expect(originRelation(true)).toBe('cross-origin')
  })

  it('reads a referrer the embedding page kept to itself as another origin', () => {
    pretend(document, 'referrer', '')
    expect(originRelation(true)).toBe('cross-origin')
  })
})

describe('measureOwnMemory', () => {
  it('refuses to guess where the browser offers no measurement', async () => {
    await expect(measureOwnMemory(OWN)).resolves.toEqual({ bytes: null, state: 'unavailable' })
  })

  it('refuses to guess where the page is not isolated enough to be measured', async () => {
    pretend(performance, 'measureUserAgentSpecificMemory', () => Promise.resolve({ breakdown: [] }))
    await expect(measureOwnMemory(OWN)).resolves.toEqual({ bytes: null, state: 'unavailable' })
  })

  it('reports the memory the browser attributed to this frame', async () => {
    measures([
      { bytes: 400, attribution: [{ url: `${OWN}index.html` }] },
      { bytes: 90, attribution: [{ url: 'https://koi.test/fish-vue/' }] },
      { bytes: 600, attribution: [{ url: `${OWN}worker.js` }] },
    ])
    await expect(measureOwnMemory(OWN)).resolves.toEqual({ bytes: 1000, state: 'measured' })
  })

  it('refuses a share of a heap that belongs to another frame', async () => {
    measures([{ bytes: 900, attribution: [{ url: 'https://koi.test/fish-vue/' }] }])
    await expect(measureOwnMemory(OWN)).resolves.toEqual({ bytes: null, state: 'unavailable' })
  })

  it('refuses a breakdown that attributes nothing to anywhere', async () => {
    measures([{ bytes: 900, attribution: [{}] }])
    await expect(measureOwnMemory(OWN)).resolves.toEqual({ bytes: null, state: 'unavailable' })
  })

  it('keeps a measurement that failed away from the koi', async () => {
    pretend(window, 'crossOriginIsolated', true)
    pretend(performance, 'measureUserAgentSpecificMemory', () => Promise.reject(new Error('measurement refused')))
    await expect(measureOwnMemory(OWN)).resolves.toEqual({ bytes: null, state: 'unavailable' })
  })
})
