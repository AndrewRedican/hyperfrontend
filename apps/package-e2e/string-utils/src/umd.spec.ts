/**
 * UMD bundle E2E tests for @hyperfrontend/string-utils
 * Tests that the UMD bundle works in browser (global) context.
 */

import { loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'
import * as path from 'path'

// String-utils is under utils/string in dist
const getBundlePath = (format: 'iife' | 'umd', minified = false) => {
  const distRoot = path.resolve(__dirname, '../../../../dist/libs/utils/string')
  const ext = minified ? '.min.js' : '.js'
  return path.join(distRoot, 'bundle', `index.${format}${ext}`)
}

describe('@hyperfrontend/string-utils UMD bundle', () => {
  const bundlePath = getBundlePath('umd')
  const minBundlePath = getBundlePath('umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendStringUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils')

    expect(global).toBeDefined()
  })

  it('should export utf8StringToUint8Array function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.utf8StringToUint8Array).toBe('function')
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.utf8StringToUint8Array).toBe('function')
    expect(typeof exports.uint8ArrayToUtf8String).toBe('function')
    expect(typeof exports.toBase64).toBe('function')
    expect(typeof exports.fromBase64).toBe('function')
  })
})
