/**
 * UMD bundle E2E tests for `@hyperfrontend/time-utils`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/time-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/time', 'umd')
  const minBundlePath = getBundlePath('utils/time', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendTimeUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils')

    expect(global).toBeDefined()
  })

  it('exports sleep on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as Record<string, unknown>

    expect(typeof global.sleep).toBe('function')
  })

  it('creates a timer from UMD bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendTimeUtils') as {
      createTimer: (callback: () => void, delay: number) => { pause: () => void; resume: () => void; reset: () => void }
    }

    const timer = global.createTimer(() => {}, 1000)

    expect(timer).toEqual(expect.objectContaining({ pause: expect.any(Function) }))

    timer.pause()
  })

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toEqual(
      expect.objectContaining({
        sleep: expect.any(Function),
        createTimer: expect.any(Function),
        createClock: expect.any(Function),
      })
    )
  })
})
