/**
 * IIFE bundle E2E tests for `@hyperfrontend/string-utils`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { loadBundleCode, executeBundleInWindow } from '../../shared/helpers'
import { resolve, join } from 'node:path'

// String-utils is under utils/string in dist
const getBundlePath = (format: 'iife' | 'umd', minified = false) => {
  const distRoot = resolve(__dirname, '../../../../dist/libs/utils/string')
  const ext = minified ? '.min.js' : '.js'
  return join(distRoot, 'bundle', `index.${format}${ext}`)
}

describe('@hyperfrontend/string-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('iife')
  const minBundlePath = getBundlePath('iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendStringUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils')

    expect(global).toBeDefined()
  })

  it('exports utf8StringToUint8Array function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.utf8StringToUint8Array).toBe('function')
  })

  it('exports uint8ArrayToUtf8String function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.uint8ArrayToUtf8String).toBe('function')
  })

  it('exports uint8ArrayToBase64 function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.uint8ArrayToBase64).toBe('function')
  })

  it('exports base64ToUint8Array function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.base64ToUint8Array).toBe('function')
  })

  it('exports toBase64 function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.toBase64).toBe('function')
  })

  it('exports fromBase64 function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.fromBase64).toBe('function')
  })
})
