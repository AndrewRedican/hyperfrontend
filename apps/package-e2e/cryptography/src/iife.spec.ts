/**
 * IIFE bundle E2E tests for `@hyperfrontend/cryptography`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/cryptography IIFE bundle', () => {
  const bundlePath = getBundlePath('cryptography', 'iife')
  const minBundlePath = getBundlePath('cryptography', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendCryptography to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendCryptography')

    expect(global).toBeDefined()
  })

  it('exports createHash function on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendCryptography') as Record<string, unknown>

    expect(typeof global.createHash).toBe('function')
  })

  it('exports encrypt function on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendCryptography') as Record<string, unknown>

    expect(typeof global.encrypt).toBe('function')
  })

  it('exports decrypt function on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendCryptography') as Record<string, unknown>

    expect(typeof global.decrypt).toBe('function')
  })

  it('exports isSHA256Hash function on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendCryptography') as Record<string, unknown>

    expect(typeof global.isSHA256Hash).toBe('function')
  })
})
