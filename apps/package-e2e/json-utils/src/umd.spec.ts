/**
 * UMD bundle E2E tests for @hyperfrontend/json-utils
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/json-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/json', 'umd')
  const minBundlePath = getBundlePath('utils/json', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendJsonUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils')

    expect(global).toBeDefined()
  })

  it('should export validate on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils') as Record<string, unknown>

    expect(typeof global.validate).toBe('function')
  })

  it('should validate data against schema from UMD bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils') as {
      validate: (data: unknown, schema: object) => { valid: boolean }
    }

    const schema = {
      type: 'string',
    }

    const result = global.validate('hello', schema)
    expect(result.valid).toBe(true)
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.validate).toBe('function')
    expect(typeof exports.createValidator).toBe('function')
    expect(typeof exports.toJsonSchema).toBe('function')
  })
})
