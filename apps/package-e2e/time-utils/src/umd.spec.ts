/**
 * UMD bundle E2E tests for @hyperfrontend/time-utils
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/time-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/time', 'umd')
  const minBundlePath = getBundlePath('utils/time', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendTimeUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils')

    expect(global).toBeDefined()
  })

  it('should export sleep on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as Record<string, unknown>

    expect(typeof global.sleep).toBe('function')
  })

  it('should create a timer from UMD bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as {
      createTimer: (callback: () => void, delay: number) => { pause: () => void; resume: () => void; reset: () => void }
    }

    const timer = global.createTimer(() => {}, 1000)

    expect(timer).toBeDefined()
    expect(typeof timer.pause).toBe('function')

    timer.pause()
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.sleep).toBe('function')
    expect(typeof exports.createTimer).toBe('function')
    expect(typeof exports.createClock).toBe('function')
  })
})
