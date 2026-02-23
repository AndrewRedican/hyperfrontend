/**
 * UMD bundle E2E tests for @hyperfrontend/data-utils
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/data-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/data', 'umd')
  const minBundlePath = getBundlePath('utils/data', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendDataUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils')

    expect(global).toBeDefined()
  })

  it('should export getType on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as Record<string, unknown>

    expect(typeof global.getType).toBe('function')
  })

  it('should correctly detect types from UMD bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      getType: (value: unknown) => string
    }

    expect(global.getType('hello')).toBe('string')
    expect(global.getType(123)).toBe('number')
    expect(global.getType([])).toBe('array')
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.getType).toBe('function')
    expect(typeof exports.isIdentical).toBe('function')
    expect(typeof exports.sameType).toBe('function')
    expect(typeof exports.traverse).toBe('function')
    expect(typeof exports.hasCircularReference).toBe('function')
  })
})
