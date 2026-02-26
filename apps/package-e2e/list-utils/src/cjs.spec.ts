/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/list-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/list-utils CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const listUtils = require('@hyperfrontend/list-utils')
    expect(listUtils).toBeDefined()
  })

  it('should export createFifoList function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createFifoList } = require('@hyperfrontend/list-utils')
    expect(typeof createFifoList).toBe('function')
  })

  it('should create a FIFO list that works correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

  it('should export createLifoList function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createLifoList } = require('@hyperfrontend/list-utils')
    expect(typeof createLifoList).toBe('function')
  })

  it('should create a LIFO list that works correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

  it('should export createRange function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createRange } = require('@hyperfrontend/list-utils')
    expect(typeof createRange).toBe('function')
  })

  it('should export createValuePicker function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createValuePicker } = require('@hyperfrontend/list-utils')
    expect(typeof createValuePicker).toBe('function')
  })

  it('should export nonEmptyStrings function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nonEmptyStrings } = require('@hyperfrontend/list-utils')
    expect(typeof nonEmptyStrings).toBe('function')
  })

  it('should export uniqueStrings function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { uniqueStrings } = require('@hyperfrontend/list-utils')
    expect(typeof uniqueStrings).toBe('function')
  })
})
