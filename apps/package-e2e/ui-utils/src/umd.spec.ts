/**
 * UMD bundle E2E tests for @hyperfrontend/ui-utils
 * Tests that the UMD bundle works in browser (global) context.
 */

import { loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'
import * as path from 'path'

// ui-utils is under utils/ui in dist
const getBundlePath = (format: 'iife' | 'umd', minified = false) => {
  const distRoot = path.resolve(__dirname, '../../../../dist/libs/utils/ui')
  const ext = minified ? '.min.js' : '.js'
  return path.join(distRoot, 'bundle', `index.${format}${ext}`)
}

describe('@hyperfrontend/ui-utils UMD bundle', () => {
  const bundlePath = getBundlePath('umd')
  const minBundlePath = getBundlePath('umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendUIUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendUIUtils')

    expect(global).toBeDefined()
  })

  it('should export hexToRgb function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendUIUtils') as Record<string, unknown>

    expect(typeof global.hexToRgb).toBe('function')
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.hexToRgb).toBe('function')
    expect(typeof exports.rgbToHex).toBe('function')
    expect(typeof exports.select).toBe('function')
  })
})
