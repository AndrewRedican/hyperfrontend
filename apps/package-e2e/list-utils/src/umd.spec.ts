/**
 * UMD bundle E2E tests for @hyperfrontend/list-utils
 * Tests that the UMD bundle works in browser (global) context.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/list-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/list', 'umd')
  const minBundlePath = getBundlePath('utils/list', 'umd', true)

  it('bundle file should exist', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file should exist', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('should attach HyperfrontendListUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils')

    expect(global).toBeDefined()
  })

  it('should export createFifoList on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils') as Record<string, unknown>

    expect(typeof global.createFifoList).toBe('function')
  })

  it('should create a working FIFO list from UMD bundle', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils') as {
      createFifoList: <T extends object>() => {
        push: (item: T) => void
        pull: () => T
        size: () => number
      }
    }

    const list = global.createFifoList<{ id: number }>()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
    expect(list.pull()).toBe(item1)
  })

  it('should work when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toBeDefined()
    expect(typeof exports.createFifoList).toBe('function')
    expect(typeof exports.createLifoList).toBe('function')
    expect(typeof exports.createRange).toBe('function')
  })
})
