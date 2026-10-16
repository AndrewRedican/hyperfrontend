/**
 * IIFE bundle E2E tests for `@hyperfrontend/function-utils`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

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

  it('creates a run-once function from IIFE bundle that returns the result on every call', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as {
      createRunOnceFunction: <T>(fn: () => T) => () => T
    }

    const fn = global.createRunOnceFunction(() => 'result')

    const firstCall = fn()
    const secondCall = fn()

    expect({ firstCall, secondCall }).toEqual({ firstCall: 'result', secondCall: 'result' })
  })

  it('creates a run-once function from IIFE bundle that executes only once', () => {
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

  it('exports noop on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as {
      noop: () => void
    }

    expect(typeof global.noop).toBe('function')
  })

  it('returns undefined from noop on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendFunctionUtils') as {
      noop: () => void
    }

    expect(global.noop()).toBeUndefined()
  })
})
