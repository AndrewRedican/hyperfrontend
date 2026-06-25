/**
 * IIFE bundle E2E tests for @hyperfrontend/features
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/features IIFE bundle', () => {
  const bundlePath = getBundlePath('features', 'iife')
  const minBundlePath = getBundlePath('features', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendFeatures to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFeatures')

    expect(global).toBeDefined()
  })

  it('should have exports on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFeatures') as Record<string, unknown>

    const exportedKeys = Object.keys(global)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })
})
