/**
 * IIFE bundle E2E tests for `@hyperfrontend/data-utils`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/data-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/data', 'iife')
  const minBundlePath = getBundlePath('utils/data', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendDataUtils to window global', () => {
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
    [{}, 'object'],
  ])('detects the type of %p as %s from IIFE bundle', (input, expected) => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      getType: (value: unknown) => string
    }

    expect(global.getType(input)).toBe(expected)
  })

  it('exports isIdentical on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      isIdentical: (a: unknown, b: unknown) => boolean
    }

    expect(typeof global.isIdentical).toBe('function')
  })

  it('detects structurally equal objects as identical from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      isIdentical: (a: unknown, b: unknown) => boolean
    }

    expect(global.isIdentical({ a: 1 }, { a: 1 })).toBe(true)
  })

  it('exports hasCircularReference on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      hasCircularReference: (value: unknown) => boolean
    }

    expect(typeof global.hasCircularReference).toBe('function')
  })

  it('reports no circular reference in an acyclic object from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendDataUtils') as {
      hasCircularReference: (value: unknown) => boolean
    }

    const obj: Record<string, unknown> = { a: 1 }
    expect(global.hasCircularReference(obj)).toBe(false)
  })
})
