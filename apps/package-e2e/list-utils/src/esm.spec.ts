/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/list-utils
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/list-utils ESM', () => {
  it('should be importable', async () => {
    const listUtils = await import('@hyperfrontend/list-utils')
    expect(listUtils).toBeDefined()
  })

  it('should export createFifoList function', async () => {
    const { createFifoList } = await import('@hyperfrontend/list-utils')
    expect(typeof createFifoList).toBe('function')
  })

  it('should create a FIFO list that works correctly', async () => {
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

  it('should export createLifoList function', async () => {
    const { createLifoList } = await import('@hyperfrontend/list-utils')
    expect(typeof createLifoList).toBe('function')
  })

  it('should create a LIFO list that works correctly', async () => {
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

  it('should export createRange function', async () => {
    const { createRange } = await import('@hyperfrontend/list-utils')
    expect(typeof createRange).toBe('function')
  })

  it('should export createValuePicker function', async () => {
    const { createValuePicker } = await import('@hyperfrontend/list-utils')
    expect(typeof createValuePicker).toBe('function')
  })

  it('should export nonEmptyStrings function', async () => {
    const { nonEmptyStrings } = await import('@hyperfrontend/list-utils')
    expect(typeof nonEmptyStrings).toBe('function')
  })

  it('should export uniqueStrings function', async () => {
    const { uniqueStrings } = await import('@hyperfrontend/list-utils')
    expect(typeof uniqueStrings).toBe('function')
  })
})
