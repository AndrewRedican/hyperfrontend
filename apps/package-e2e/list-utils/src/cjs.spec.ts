/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/list-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/list-utils CJS', () => {
  it('is requireable', () => {
    const listUtils = require('@hyperfrontend/list-utils')
    expect(listUtils).toBeDefined()
  })

  it('exports createFifoList function', () => {
    const { createFifoList } = require('@hyperfrontend/list-utils')
    expect(typeof createFifoList).toBe('function')
  })

  it('creates a FIFO list that works correctly', () => {
    const { createFifoList } = require('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
    expect(list.pull()).toBe(item1) // First in, first out
    expect(list.size()).toBe(1)
  })

  it('exports createLifoList function', () => {
    const { createLifoList } = require('@hyperfrontend/list-utils')
    expect(typeof createLifoList).toBe('function')
  })

  it('creates a LIFO list that works correctly', () => {
    const { createLifoList } = require('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
    expect(list.pull()).toBe(item2) // Last in, first out
    expect(list.size()).toBe(1)
  })

  it('exports createRange function', () => {
    const { createRange } = require('@hyperfrontend/list-utils')
    expect(typeof createRange).toBe('function')
  })

  it('exports createValuePicker function', () => {
    const { createValuePicker } = require('@hyperfrontend/list-utils')
    expect(typeof createValuePicker).toBe('function')
  })

  it('exports nonEmptyStrings function', () => {
    const { nonEmptyStrings } = require('@hyperfrontend/list-utils')
    expect(typeof nonEmptyStrings).toBe('function')
  })

  it('exports uniqueStrings function', () => {
    const { uniqueStrings } = require('@hyperfrontend/list-utils')
    expect(typeof uniqueStrings).toBe('function')
  })
})
