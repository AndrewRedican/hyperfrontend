/**
 * IIFE bundle E2E tests for `@hyperfrontend/network-protocol`
 * Tests that the browser bundles load correctly and attach to window.
 *
 * Note: network-protocol has two browser bundles with separate global names:
 * - HyperfrontendNetworkProtocolV1 (v1 protocol)
 * - HyperfrontendNetworkProtocolV2 (v2 protocol)
 */

import { describe, expect, it } from '@hyperfrontend/testing'

import { loadBundleCode, executeBundleInWindow } from '../../shared/helpers'
import { resolve, join } from 'node:path'

// Bundle paths for network-protocol are different - it has v1 and v2 subdirectories
const getBundlePath = (version: 'v1' | 'v2', format: 'iife' | 'umd', minified = false) => {
  const distRoot = resolve(process.cwd(), 'dist/libs/network-protocol')
  const ext = minified ? '.min.js' : '.js'
  return join(distRoot, 'bundle', version, `index.${format}${ext}`)
}

describe('@hyperfrontend/network-protocol IIFE bundle', () => {
  describe('V1 bundle', () => {
    const bundlePath = getBundlePath('v1', 'iife')
    const minBundlePath = getBundlePath('v1', 'iife', true)

    it('bundle file exists', () => {
      expect(() => loadBundleCode(bundlePath)).not.toThrow()
    })

    it('minified bundle file exists', () => {
      expect(() => loadBundleCode(minBundlePath)).not.toThrow()
    })

    it('attaches HyperfrontendNetworkProtocolV1 to window global', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const global = executeBundleInWindow(bundleCode, 'HyperfrontendNetworkProtocolV1')

      expect(global).toBeDefined()
    })

    it('exports createProtocol function on V1 global', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const global = executeBundleInWindow(bundleCode, 'HyperfrontendNetworkProtocolV1') as Record<string, unknown>

      expect(typeof global.createProtocol).toBe('function')
    })
  })

  describe('V2 bundle', () => {
    const bundlePath = getBundlePath('v2', 'iife')
    const minBundlePath = getBundlePath('v2', 'iife', true)

    it('bundle file exists', () => {
      expect(() => loadBundleCode(bundlePath)).not.toThrow()
    })

    it('minified bundle file exists', () => {
      expect(() => loadBundleCode(minBundlePath)).not.toThrow()
    })

    it('attaches HyperfrontendNetworkProtocolV2 to window global', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const global = executeBundleInWindow(bundleCode, 'HyperfrontendNetworkProtocolV2')

      expect(global).toBeDefined()
    })

    it('exports createProtocol function on V2 global', () => {
      const bundleCode = loadBundleCode(bundlePath)
      const global = executeBundleInWindow(bundleCode, 'HyperfrontendNetworkProtocolV2') as Record<string, unknown>

      expect(typeof global.createProtocol).toBe('function')
    })
  })
})
