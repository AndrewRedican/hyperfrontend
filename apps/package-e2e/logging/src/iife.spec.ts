/**
 * IIFE bundle E2E tests for @hyperfrontend/logging
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/logging IIFE bundle', () => {
  const bundlePath = getBundlePath('logging', 'iife')
  const minBundlePath = getBundlePath('logging', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendLogging to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging')

    expect(global).toBeDefined()
  })

  it('should export createLogger on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging') as Record<string, unknown>

    expect(typeof global.createLogger).toBe('function')
  })

  it('should create a working logger from IIFE bundle', () => {
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
    const mockInfo = jest.fn()
    const logger = global.createLogger(mockError, jest.fn(), jest.fn(), mockInfo)

    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
  })
})
