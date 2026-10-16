/**
 * UMD bundle E2E tests for `@hyperfrontend/function-utils`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/function-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/function', 'umd')
  const minBundlePath = getBundlePath('utils/function', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendFunctionUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils')

    expect(global).toBeDefined()
  })

  it('exports createRunOnceFunction on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as Record<string, unknown>

    expect(typeof global.createRunOnceFunction).toBe('function')
  })

  it('creates a run-once function from UMD bundle that returns the result on every call', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as {
      createRunOnceFunction: <T>(fn: () => T) => () => T
    }

    const fn = global.createRunOnceFunction(() => 'result')

    const firstCall = fn()
    const secondCall = fn()

    expect({ firstCall, secondCall }).toEqual({ firstCall: 'result', secondCall: 'result' })
  })

  it('creates a run-once function from UMD bundle that executes only once', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as {
      createRunOnceFunction: <T>(fn: () => T) => () => T
    }

    let callCount = 0
    const fn = global.createRunOnceFunction(() => {
      callCount++
      return 'result'
    })

    fn()
    fn()

    expect(callCount).toBe(1)
  })

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toEqual(
      expect.objectContaining({
        createRunOnceFunction: expect.any(Function),
        noop: expect.any(Function),
      })
    )
  })
})
