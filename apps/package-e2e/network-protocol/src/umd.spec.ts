/**
 * UMD bundle E2E tests for `@hyperfrontend/network-protocol`
 * Tests that the UMD bundles work in browser (global) context.
 *
 * Note: network-protocol has two browser bundles with separate global names:
 * - HyperfrontendNetworkProtocolV1 (v1 protocol)
 * - HyperfrontendNetworkProtocolV2 (v2 protocol)
 */

import { describe, expect, it } from '@hyperfrontend/testing'

import { loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'
import { resolve, join } from 'node:path'

// Bundle paths for network-protocol are different - it has v1 and v2 subdirectories
const getBundlePath = (version: 'v1' | 'v2', format: 'iife' | 'umd', minified = false) => {
  const distRoot = resolve(process.cwd(), 'dist/libs/network-protocol')
  const ext = minified ? '.min.js' : '.js'
  return join(distRoot, 'bundle', version, `index.${format}${ext}`)
}

describe('@hyperfrontend/network-protocol UMD bundle', () => {
  describe('V1 bundle', () => {
    const bundlePath = getBundlePath('v1', 'umd')
    const minBundlePath = getBundlePath('v1', 'umd', true)

    it('bundle file exists', () => {
      expect(() => loadBundleCode(bundlePath)).not.toThrow()
    })

    it('minified bundle file exists', () => {
      expect(() => loadBundleCode(minBundlePath)).not.toThrow()
    })

    it('attaches HyperfrontendNetworkProtocolV1 to window global (browser mode)', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const global = executeBundleInWindow(bundleCode, 'HyperfrontendNetworkProtocolV1')

      expect(global).toBeDefined()
    })

    it('works when required as CJS module', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

      expect(exports).toBeDefined()
      expect(typeof exports.createProtocol).toBe('function')
    })
  })

  describe('V2 bundle', () => {
    const bundlePath = getBundlePath('v2', 'umd')
    const minBundlePath = getBundlePath('v2', 'umd', true)

    it('bundle file exists', () => {
      expect(() => loadBundleCode(bundlePath)).not.toThrow()
    })

    it('minified bundle file exists', () => {
      expect(() => loadBundleCode(minBundlePath)).not.toThrow()
    })

    it('attaches HyperfrontendNetworkProtocolV2 to window global (browser mode)', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const global = executeBundleInWindow(bundleCode, 'HyperfrontendNetworkProtocolV2')

      expect(global).toBeDefined()
    })

    it('works when required as CJS module', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

      expect(exports).toBeDefined()
      expect(typeof exports.createProtocol).toBe('function')
    })
  })
})
