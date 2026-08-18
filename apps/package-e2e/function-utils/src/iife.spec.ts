/**
 * IIFE bundle E2E tests for `@hyperfrontend/function-utils`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/function-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/function', 'iife')
  const minBundlePath = getBundlePath('utils/function', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendFunctionUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils')

    expect(global).toBeDefined()
  })

  it('exports createRunOnceFunction on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as Record<string, unknown>

    expect(typeof global.createRunOnceFunction).toBe('function')
  })

  it('creates a working run-once function from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as {
      createRunOnceFunction: <T>(fn: () => T) => () => T
    }

    let callCount = 0
    const fn = global.createRunOnceFunction(() => {
      callCount++
      return 'result'
    })

    expect(fn()).toBe('result')
    expect(fn()).toBe('result')
    expect(callCount).toBe(1)
  })

  it('exports noop on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as {
      noop: () => void
    }

    expect(typeof global.noop).toBe('function')
    expect(global.noop()).toBeUndefined()
  })
})
