/**
 * UMD bundle E2E tests for `@hyperfrontend/immutable-api-utils`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/immutable-api-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/immutable-api', 'umd')
  const minBundlePath = getBundlePath('utils/immutable-api', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendImmutableApiUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils')

    expect(global).toBeDefined()
  })

  it('exports lockedPropertyDescriptors on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendImmutableApiUtils') as Record<string, unknown>

    expect(typeof global.lockedPropertyDescriptors).toBe('function')
  })

  it('creates locked property descriptors from UMD bundle', () => {
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

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.lockedPropertyDescriptors).toBe('function')
    expect(typeof exports.lockedProps).toBe('function')
    expect(typeof exports.locked).toBe('function')
  })
})
