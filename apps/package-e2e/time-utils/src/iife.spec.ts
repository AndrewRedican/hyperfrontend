/**
 * IIFE bundle E2E tests for @hyperfrontend/time-utils
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/time-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/time', 'iife')
  const minBundlePath = getBundlePath('utils/time', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendTimeUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils')

    expect(global).toBeDefined()
  })

  it('should export sleep on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as Record<string, unknown>

    expect(typeof global.sleep).toBe('function')
  })

  it('should sleep returns a promise that resolves', async () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as {
      sleep: (ms: number) => Promise<void>
    }

    const start = Date.now()
    await global.sleep(10)
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(9)
  })

  it('should export createTimer on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as Record<string, unknown>

    expect(typeof global.createTimer).toBe('function')
  })

  it('should create a timer with pause, resume, reset methods', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as {
      createTimer: (callback: () => void, delay: number) => { pause: () => void; resume: () => void; reset: () => void }
    }

    const timer = global.createTimer(() => {}, 1000)

    expect(timer).toBeDefined()
    expect(typeof timer.pause).toBe('function')
    expect(typeof timer.resume).toBe('function')
    expect(typeof timer.reset).toBe('function')

    timer.pause()
  })
})
