/**
 * UMD bundle E2E tests for @hyperfrontend/logging
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/logging UMD bundle', () => {
  const bundlePath = getBundlePath('logging', 'umd')
  const minBundlePath = getBundlePath('logging', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendLogging to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging')

    expect(global).toBeDefined()
  })

  it('should export createLogger on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging') as Record<string, unknown>

    expect(typeof global.createLogger).toBe('function')
  })

  it('should create a working logger from UMD bundle', () => {
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

    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('should be requireable as CommonJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.createLogger).toBe('function')
  })
})
