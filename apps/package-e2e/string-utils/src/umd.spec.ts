/**
 * UMD bundle E2E tests for @hyperfrontend/string-utils
 * Tests that the UMD bundle works in browser (global) context.
 */

import { loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'
import { resolve, join } from 'node:path'

// String-utils is under utils/string in dist
const getBundlePath = (format: 'iife' | 'umd', minified = false) => {
  const distRoot = resolve(__dirname, '../../../../dist/libs/utils/string')
  const ext = minified ? '.min.js' : '.js'
  return join(distRoot, 'bundle', `index.${format}${ext}`)
}

describe('@hyperfrontend/string-utils UMD bundle', () => {
  const bundlePath = getBundlePath('umd')
  const minBundlePath = getBundlePath('umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendStringUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils')

    expect(global).toBeDefined()
  })

  it('exports utf8StringToUint8Array function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendStringUtils') as Record<string, unknown>

    expect(typeof global.utf8StringToUint8Array).toBe('function')
  })

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.utf8StringToUint8Array).toBe('function')
    expect(typeof exports.uint8ArrayToUtf8String).toBe('function')
    expect(typeof exports.toBase64).toBe('function')
    expect(typeof exports.fromBase64).toBe('function')
  })
})
