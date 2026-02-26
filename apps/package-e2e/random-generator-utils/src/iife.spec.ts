/**
 * IIFE bundle E2E tests for @hyperfrontend/random-generator-utils
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/random-generator-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/random-generator', 'iife')
  const minBundlePath = getBundlePath('utils/random-generator', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendRandomGenerator to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator')

    expect(global).toBeDefined()
  })

  it('should export uuidV4 on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator') as Record<string, unknown>

    expect(typeof global.uuidV4).toBe('function')
  })

  it('should generate valid UUIDv4 from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator') as {
      uuidV4: () => string
      isUuidV4: (str: string) => boolean
    }

    const uuid = global.uuidV4()
    expect(typeof uuid).toBe('string')
    expect(global.isUuidV4(uuid)).toBe(true)
  })

  it('should export randomUniform on the global', () => {
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
