/**
 * UMD bundle E2E tests for `@hyperfrontend/nexus`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/nexus UMD bundle', () => {
  const bundlePath = getBundlePath('nexus', 'umd')
  const minBundlePath = getBundlePath('nexus', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendNexus to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus')

    expect(global).toBeDefined()
  })

  it('exports createBroker on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus') as Record<string, unknown>

    expect(typeof global.createBroker).toBe('function')
  })

  it('exports createChannel on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendNexus') as Record<string, unknown>

    expect(typeof global.createChannel).toBe('function')
  })

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.createBroker).toBe('function')
    expect(typeof exports.createChannel).toBe('function')
    expect(typeof exports.mergeContracts).toBe('function')
  })
})
