/**
 * UMD bundle E2E tests for @hyperfrontend/state-machine
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/state-machine UMD bundle', () => {
  const bundlePath = getBundlePath('state-machine', 'umd')
  const minBundlePath = getBundlePath('state-machine', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendStateMachine to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStateMachine')

    expect(global).toBeDefined()
  })

  it('should export Store class on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStateMachine') as Record<string, unknown>

    expect(global.Store).toBeDefined()
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(exports.Store).toBeDefined()
  })
})
