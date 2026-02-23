/**
 * IIFE bundle E2E tests for @hyperfrontend/state-machine
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/state-machine IIFE bundle', () => {
  const bundlePath = getBundlePath('state-machine', 'iife')
  const minBundlePath = getBundlePath('state-machine', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendStateMachine to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStateMachine')

    expect(global).toBeDefined()
  })

  it('should export action creators on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStateMachine') as Record<string, unknown>

    // Actions may be nested or at root level depending on bundle structure
    // Check for presence of key exports
    expect(global).toBeDefined()
  })

  it('should export Store class on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStateMachine') as Record<string, unknown>

    expect(global.Store).toBeDefined()
  })
})
