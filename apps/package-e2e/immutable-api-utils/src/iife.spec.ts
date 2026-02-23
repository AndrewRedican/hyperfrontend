/**
 * IIFE bundle E2E tests for @hyperfrontend/immutable-api-utils
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/immutable-api-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/immutable-api', 'iife')
  const minBundlePath = getBundlePath('utils/immutable-api', 'iife', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendImmutableApiUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils')

    expect(global).toBeDefined()
  })

  it('should export lockedPropertyDescriptors on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils') as Record<string, unknown>

    expect(typeof global.lockedPropertyDescriptors).toBe('function')
  })

  it('should create locked property descriptors from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils') as {
      lockedPropertyDescriptors: (value: unknown, enumerable?: boolean) => PropertyDescriptor
    }

    const descriptor = global.lockedPropertyDescriptors('test-value')
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('should export lockedProps on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils') as Record<string, unknown>

    expect(typeof global.lockedProps).toBe('function')
  })
})
