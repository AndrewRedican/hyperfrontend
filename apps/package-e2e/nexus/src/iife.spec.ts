/**
 * IIFE bundle E2E tests for @hyperfrontend/nexus
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/nexus IIFE bundle', () => {
  const bundlePath = getBundlePath('nexus', 'iife')
  const minBundlePath = getBundlePath('nexus', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendNexus to window global', () => {
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

  it('should export mergeContracts on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus') as Record<string, unknown>

    expect(typeof global.mergeContracts).toBe('function')
  })

  it('should export defaultBroker singleton on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus') as Record<string, unknown>

    expect(global.defaultBroker).toBeDefined()
  })
})
