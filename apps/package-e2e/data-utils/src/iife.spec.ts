/**
 * IIFE bundle E2E tests for @hyperfrontend/data-utils
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/data-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/data', 'iife')
  const minBundlePath = getBundlePath('utils/data', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendDataUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils')

    expect(global).toBeDefined()
  })

  it('should export getType on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as Record<string, unknown>

    expect(typeof global.getType).toBe('function')
  })

  it('should correctly detect types from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      getType: (value: unknown) => string
    }

    expect(global.getType('hello')).toBe('string')
    expect(global.getType(123)).toBe('number')
    expect(global.getType([])).toBe('array')
    expect(global.getType({})).toBe('object')
  })

  it('should export isIdentical on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      isIdentical: (a: unknown, b: unknown) => boolean
    }

    expect(typeof global.isIdentical).toBe('function')
    expect(global.isIdentical({ a: 1 }, { a: 1 })).toBe(true)
  })

  it('should export hasCircularReference on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      hasCircularReference: (value: unknown) => boolean
    }

    expect(typeof global.hasCircularReference).toBe('function')

    const obj: Record<string, unknown> = { a: 1 }
    expect(global.hasCircularReference(obj)).toBe(false)
  })
})
