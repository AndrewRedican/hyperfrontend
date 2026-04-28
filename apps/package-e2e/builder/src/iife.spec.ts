/**
 * IIFE bundle E2E tests for @hyperfrontend/builder
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/builder IIFE bundle', () => {
  const bundlePath = getBundlePath('builder', 'iife')
  const minBundlePath = getBundlePath('builder', 'iife', true)

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
