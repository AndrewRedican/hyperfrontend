/**
 * IIFE bundle E2E tests for @hyperfrontend/json-utils
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/json-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/json', 'iife')
  const minBundlePath = getBundlePath('utils/json', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendJsonUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils')

    expect(global).toBeDefined()
  })

  it('exports validate on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils') as Record<string, unknown>

    expect(typeof global.validate).toBe('function')
  })

  it('validates data against schema from IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils') as {
      validate: (data: unknown, schema: object) => { valid: boolean }
    }

    const schema = {
      type: 'string',
    }

    const result = global.validate('hello', schema)
    expect(result.valid).toBe(true)

    const invalidResult = global.validate(123, schema)
    expect(invalidResult.valid).toBe(false)
  })

  it('exports toJsonSchema on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils') as Record<string, unknown>

    expect(typeof global.toJsonSchema).toBe('function')
  })

  it('generates JSON schema from data via IIFE bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendJsonUtils') as {
      toJsonSchema: (data: unknown) => { type: string; properties?: object }
    }

    const schema = global.toJsonSchema({ name: 'test' })
    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
  })
})
