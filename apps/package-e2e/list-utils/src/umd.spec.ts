/**
 * UMD bundle E2E tests for `@hyperfrontend/list-utils`
 * Tests that the UMD bundle works in browser (global) context.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { getBundlePath, loadBundleCode, executeBundleInWindow, requireUmdBundle } from '../../shared/helpers'

describe('@hyperfrontend/list-utils UMD bundle', () => {
  const bundlePath = getBundlePath('utils/list', 'umd')
  const minBundlePath = getBundlePath('utils/list', 'umd', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendListUtils to window global (browser mode)', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils')

    expect(global).toBeDefined()
  })

  it('exports createFifoList on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils') as Record<string, unknown>

    expect(typeof global.createFifoList).toBe('function')
  })

  it('creates a FIFO list from UMD bundle that counts every pushed item', () => {
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
  })

  it('creates a FIFO list from UMD bundle that pulls the first pushed item first', () => {
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

    expect(list.pull()).toBe(item1)
  })

  it('works when required as CJS module', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const exports = requireUmdBundle(bundleCode) as Record<string, unknown>

    expect(exports).toEqual(
      expect.objectContaining({
        createFifoList: expect.any(Function),
        createLifoList: expect.any(Function),
        createRange: expect.any(Function),
      })
    )
  })
})
