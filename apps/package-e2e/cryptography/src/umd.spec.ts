/**
 * UMD bundle E2E tests for @hyperfrontend/cryptography
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/cryptography UMD bundle', () => {
  const bundlePath = getBundlePath('cryptography', 'umd')
  const minBundlePath = getBundlePath('cryptography', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendCryptography to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendCryptography')

    expect(global).toBeDefined()
  })

  it('should export createHash function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendCryptography') as Record<string, unknown>

    expect(typeof global.createHash).toBe('function')
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.createHash).toBe('function')
    expect(typeof exports.encrypt).toBe('function')
    expect(typeof exports.decrypt).toBe('function')
  })
})
