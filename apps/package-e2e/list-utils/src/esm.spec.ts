/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/list-utils`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, expect, it } from '@hyperfrontend/testing'

describe('@hyperfrontend/list-utils ESM', () => {
  it('is importable', async () => {
    const listUtils = await import('@hyperfrontend/list-utils')
    expect(listUtils).toBeDefined()
  })

  it('exports createFifoList function', async () => {
    const { createFifoList } = await import('@hyperfrontend/list-utils')
    expect(typeof createFifoList).toBe('function')
  })

  it('creates a FIFO list that works correctly', async () => {
    const { createFifoList } = await import('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
    expect(list.pull()).toBe(item1) // First in, first out
    expect(list.size()).toBe(1)
  })

  it('exports createLifoList function', async () => {
    const { createLifoList } = await import('@hyperfrontend/list-utils')
    expect(typeof createLifoList).toBe('function')
  })

  it('creates a LIFO list that works correctly', async () => {
    const { createLifoList } = await import('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
    expect(list.pull()).toBe(item2) // Last in, first out
    expect(list.size()).toBe(1)
  })

  it('exports createRange function', async () => {
    const { createRange } = await import('@hyperfrontend/list-utils')
    expect(typeof createRange).toBe('function')
  })

  it('exports createValuePicker function', async () => {
    const { createValuePicker } = await import('@hyperfrontend/list-utils')
    expect(typeof createValuePicker).toBe('function')
  })

  it('exports nonEmptyStrings function', async () => {
    const { nonEmptyStrings } = await import('@hyperfrontend/list-utils')
    expect(typeof nonEmptyStrings).toBe('function')
  })

  it('exports uniqueStrings function', async () => {
    const { uniqueStrings } = await import('@hyperfrontend/list-utils')
    expect(typeof uniqueStrings).toBe('function')
  })
})
