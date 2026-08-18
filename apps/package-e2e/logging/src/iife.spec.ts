/**
 * IIFE bundle E2E tests for `@hyperfrontend/logging`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/logging IIFE bundle', () => {
  const bundlePath = getBundlePath('logging', 'iife')
  const minBundlePath = getBundlePath('logging', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendLogging to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging')

    expect(global).toBeDefined()
  })

  it('exports createLogger on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendLogging') as Record<string, unknown>

    expect(typeof global.createLogger).toBe('function')
  })

  it('creates a working logger from IIFE bundle', () => {
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
