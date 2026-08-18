/**
 * UMD bundle E2E tests for `@hyperfrontend/random-generator-utils`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/random-generator-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/random-generator', 'umd')
  const minBundlePath = getBundlePath('utils/random-generator', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendRandomGenerator to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator')

    expect(global).toBeDefined()
  })

  it('exports uuidV4 on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator') as Record<string, unknown>

    expect(typeof global.uuidV4).toBe('function')
  })

  it('generates valid UUIDv4 from UMD bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendRandomGenerator') as {
      uuidV4: () => string
      isUuidV4: (str: string) => boolean
    }

    const uuid = global.uuidV4()
    expect(typeof uuid).toBe('string')
    expect(global.isUuidV4(uuid)).toBe(true)
  })

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.uuidV4).toBe('function')
    expect(typeof exports.isUuidV4).toBe('function')
    expect(typeof exports.randomUniform).toBe('function')
    expect(typeof exports.randomGaussian).toBe('function')
  })
})
