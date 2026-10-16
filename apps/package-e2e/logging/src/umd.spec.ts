/**
 * UMD bundle E2E tests for `@hyperfrontend/logging`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { describe, it, expect, jest } from '@hyperfrontend/testing'

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/logging UMD bundle', () => {
  const bundlePath = getBundlePath('logging', 'umd')
  const minBundlePath = getBundlePath('logging', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendLogging to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging')

    expect(global).toBeDefined()
  })

  it('exports createLogger on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging') as Record<string, unknown>

    expect(typeof global.createLogger).toBe('function')
  })

  it('creates a working logger from UMD bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging') as {
      createLogger: (
        error: () => void,
        warn?: () => void,
        log?: () => void,
        info?: () => void
      ) => {
        info: () => void
        error: () => void
      }
    }

    const mockError = jest.fn()
    const logger = global.createLogger(mockError)

    expect(logger).toEqual(
      expect.objectContaining({
        info: expect.any(Function),
        error: expect.any(Function),
      })
    )
  })

  it('is requireable as CommonJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toEqual(expect.objectContaining({ createLogger: expect.any(Function) }))
  })
})
