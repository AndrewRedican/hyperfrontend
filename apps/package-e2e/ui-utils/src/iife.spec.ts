/**
 * IIFE bundle E2E tests for `@hyperfrontend/ui-utils`
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { loadBundleCode, executeBundleInWindow } from '../../shared/helpers'
import { resolve, join } from 'node:path'

import { describe, it, expect } from '@hyperfrontend/testing'

// ui-utils is under utils/ui in dist
const getBundlePath = (format: 'iife' | 'umd', minified = false) => {
  const distRoot = resolve(__dirname, '../../../../dist/libs/utils/ui')
  const ext = minified ? '.min.js' : '.js'
  return join(distRoot, 'bundle', `index.${format}${ext}`)
}

describe('@hyperfrontend/ui-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('iife')
  const minBundlePath = getBundlePath('iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendUIUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendUIUtils')

    expect(global).toBeDefined()
  })

  it('exports hexToRgb function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendUIUtils') as Record<string, unknown>

    expect(typeof global.hexToRgb).toBe('function')
  })

  it('exports rgbToHex function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendUIUtils') as Record<string, unknown>

    expect(typeof global.rgbToHex).toBe('function')
  })

  it('exports select function', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendUIUtils') as Record<string, unknown>

    expect(typeof global.select).toBe('function')
  })

  it('hexToRgb works correctly', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendUIUtils') as Record<
      string,
      (hex: string) => { r: number; g: number; b: number }
    >

    const rgb = global.hexToRgb('#00ff00')
    expect(rgb).toEqual({ r: 0, g: 255, b: 0 })
  })
})
