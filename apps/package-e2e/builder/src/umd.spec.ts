/**
 * UMD bundle E2E tests for @hyperfrontend/builder
 * Tests that the UMD bundle loads correctly in browser context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/builder UMD bundle', () => {
  const bundlePath = getBundlePath('builder', 'umd')
  const minBundlePath = getBundlePath('builder', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendBuilder to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendBuilder')

    expect(global).toBeDefined()
  })

  it('should have exports on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendBuilder') as Record<string, unknown>

    const exportedKeys = Object.keys(global)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })
})
