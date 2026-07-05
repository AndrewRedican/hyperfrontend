/**
 * IIFE bundle E2E tests for @hyperfrontend/list-utils
 * Tests that the browser bundle loads correctly and attaches to window.
 */

import { getBundlePath, loadBundleCode, executeBundleInWindow } from '../../shared/helpers'

describe('@hyperfrontend/list-utils IIFE bundle', () => {
  const bundlePath = getBundlePath('utils/list', 'iife')
  const minBundlePath = getBundlePath('utils/list', 'iife', true)

  it('bundle file exists', () => {
    expect(() => loadBundleCode(bundlePath)).not.toThrow()
  })

  it('minified bundle file exists', () => {
    expect(() => loadBundleCode(minBundlePath)).not.toThrow()
  })

  it('attaches HyperfrontendListUtils to window global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils')

    expect(global).toBeDefined()
  })

  it('exports createFifoList on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils') as Record<string, unknown>

    expect(typeof global.createFifoList).toBe('function')
  })

  it('creates a working FIFO list from IIFE bundle', () => {
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

  it('exports createLifoList on the global', () => {
    const bundleCode = loadBundleCode(bundlePath)
    const global = executeBundleInWindow(bundleCode, 'HyperfrontendListUtils') as Record<string, unknown>

    expect(typeof global.createLifoList).toBe('function')
  })
})
