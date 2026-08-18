/**
 * IIFE bundle E2E tests for `@hyperfrontend/immutable-api-utils`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/immutable-api-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/immutable-api', 'iife')
  const minBundlePath = getBundlePath('utils/immutable-api', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendImmutableApiUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils')

    expect(global).toBeDefined()
  })

  it('exports lockedPropertyDescriptors on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils') as Record<string, unknown>

    expect(typeof global.lockedPropertyDescriptors).toBe('function')
  })

  it('creates locked property descriptors from IIFE bundle', () => {
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

  it('exports lockedProps on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils') as Record<string, unknown>

    expect(typeof global.lockedProps).toBe('function')
  })
})
