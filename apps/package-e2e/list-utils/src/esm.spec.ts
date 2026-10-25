/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/list-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/list-utils ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/list-utils')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        createFifoList: 'function',
        createLifoList: 'function',
        createRange: 'function',
        createValuePicker: 'function',
        nonEmptyStrings: 'function',
        uniqueStrings: 'function',
      })
    )
  })

  it('creates a FIFO list that counts every pushed item', () => {
    const size = consumer.run(async () => {
      const { createFifoList } = await import('@hyperfrontend/list-utils')
      const list = createFifoList()
      list.push({ id: 1 })
      list.push({ id: 2 })
      return list.size()
    })
    expect(size).toBe(2)
  })

  it('creates a FIFO list that pulls the first pushed item first', () => {
    const pulled = consumer.run(async () => {
      const { createFifoList } = await import('@hyperfrontend/list-utils')
      const list = createFifoList()
      list.push({ id: 1 })
      list.push({ id: 2 })
      return list.pull()
    })
    expect(pulled).toEqual({
      id: 1,
    })
  })

  it('creates a FIFO list that no longer counts a pulled item', () => {
    const size = consumer.run(async () => {
      const { createFifoList } = await import('@hyperfrontend/list-utils')
      const list = createFifoList()
      list.push({ id: 1 })
      list.push({ id: 2 })
      list.pull()
      return list.size()
    })
    expect(size).toBe(1)
  })

  it('creates a LIFO list that pulls the last pushed item first', () => {
    const pulled = consumer.run(async () => {
      const { createLifoList } = await import('@hyperfrontend/list-utils')
      const list = createLifoList()
      list.push({ id: 1 })
      list.push({ id: 2 })
      return list.pull()
    })
    expect(pulled).toEqual({
      id: 2,
    })
  })

  it('creates a LIFO list that no longer counts a pulled item', () => {
    const size = consumer.run(async () => {
      const { createLifoList } = await import('@hyperfrontend/list-utils')
      const list = createLifoList()
      list.push({ id: 1 })
      list.push({ id: 2 })
      list.pull()
      return list.size()
    })
    expect(size).toBe(1)
  })

  it('creates an inclusive numeric range', () => {
    const range = consumer.run(async () => {
      const { createRange } = await import('@hyperfrontend/list-utils')
      return createRange(1, 4)
    })
    expect(range).toEqual([1, 2, 3, 4])
  })

  it('keeps one of each string through uniqueStrings', () => {
    const unique = consumer.run(async () => {
      const { uniqueStrings } = await import('@hyperfrontend/list-utils')
      return uniqueStrings(['a', 'a', 'b'])
    })
    expect(unique).toEqual(['a', 'b'])
  })

  it('drops empty and blank strings through nonEmptyStrings', () => {
    const kept = consumer.run(async () => {
      const { nonEmptyStrings } = await import('@hyperfrontend/list-utils')
      return nonEmptyStrings(['a', '', '  ', 'b'])
    })
    expect(kept).toEqual(['a', 'b'])
  })

  it('cycles through the values of a value picker', () => {
    const picks = consumer.run(async () => {
      const { createValuePicker } = await import('@hyperfrontend/list-utils')
      const picker = createValuePicker(['red', 'green'])
      return [picker.next(), picker.next(), picker.next()]
    })
    expect(picks).toEqual(['red', 'green', 'red'])
  })
})
