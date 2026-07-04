/**
 * IIFE bundle E2E tests for @hyperfrontend/random-generator-utils
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/random-generator-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/random-generator', 'iife')
  const minBundlePath = getBundlePath('utils/random-generator', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendRandomGenerator to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator')

    expect(global).toBeDefined()
  })

  it('exports uuidV4 on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator') as Record<string, unknown>

    expect(typeof global.uuidV4).toBe('function')
  })

  it('generates valid UUIDv4 from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator') as {
      uuidV4: () => string
      isUuidV4: (str: string) => boolean
    }

    const uuid = global.uuidV4()
    expect(typeof uuid).toBe('string')
    expect(global.isUuidV4(uuid)).toBe(true)
  })

  it('exports randomUniform on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator') as {
      randomUniform: (min: number, max: number) => number
    }

    expect(typeof global.randomUniform).toBe('function')

    const value = global.randomUniform(0, 10)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(10)
  })
})
