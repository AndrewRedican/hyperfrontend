/**
 * UMD bundle E2E tests for `@hyperfrontend/data-utils`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/data-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/data', 'umd')
  const minBundlePath = getBundlePath('utils/data', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendDataUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils')

    expect(global).toBeDefined()
  })

  it('exports getType on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as Record<string, unknown>

    expect(typeof global.getType).toBe('function')
  })

  it.each([
    ['hello', 'string'],
    [123, 'number'],
    [[], 'array'],
  ])('detects the type of %p as %s from UMD bundle', (input, expected) => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      getType: (value: unknown) => string
    }

    expect(global.getType(input)).toBe(expected)
  })

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toEqual(
      expect.objectContaining({
        getType: expect.any(Function),
        isIdentical: expect.any(Function),
        sameType: expect.any(Function),
        traverse: expect.any(Function),
        hasCircularReference: expect.any(Function),
      })
    )
  })
})
