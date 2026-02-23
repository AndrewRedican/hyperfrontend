/**
 * UMD bundle E2E tests for @hyperfrontend/nexus
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/nexus UMD bundle', () => {
  const bundlePath = getBundlePath('nexus', 'umd')
  const minBundlePath = getBundlePath('nexus', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendNexus to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus')

    expect(global).toBeDefined()
  })

  it('should export createBroker on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus') as Record<string, unknown>

    expect(typeof global.createBroker).toBe('function')
  })

  it('should export createChannel on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus') as Record<string, unknown>

    expect(typeof global.createChannel).toBe('function')
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.createBroker).toBe('function')
    expect(typeof exports.createChannel).toBe('function')
    expect(typeof exports.mergeContracts).toBe('function')
  })
})
