/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/list-utils`
 * Tests that the package is importable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/list-utils'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { createFifoList, createLifoList, createRange, createValuePicker, nonEmptyStrings, uniqueStrings } from '@hyperfrontend/list-utils'",
  'async function main() {',
  '  const first = { id: 1 }',
  '  const second = { id: 2 }',
  '  const fifo = createFifoList()',
  '  fifo.push(first)',
  '  fifo.push(second)',
  '  const lifo = createLifoList()',
  '  lifo.push(first)',
  '  lifo.push(second)',
  "  const picker = createValuePicker(['red', 'green'])",
  '  return {',
  '    fifo: [fifo.pull() === first, fifo.size()],',
  '    lifo: [lifo.pull() === second, lifo.size()],',
  '    range: createRange(1, 4),',
  "    unique: uniqueStrings(['a', 'a', 'b']),",
  "    nonEmpty: nonEmptyStrings(['a', '', '  ', 'b']),",
  '    picks: [picker.next(), picker.next(), picker.next()],',
  '  }',
  '}',
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/list-utils ESM', () => {
  it('is importable', async () => {
    const listUtils = await import('@hyperfrontend/list-utils')
    expect(listUtils).toBeDefined()
  })

  it('exports createFifoList function', async () => {
    const { createFifoList } = await import('@hyperfrontend/list-utils')
    expect(typeof createFifoList).toBe('function')
  })

  it('creates a FIFO list that counts every pushed item', async () => {
    const { createFifoList } = await import('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
  })

  it('creates a FIFO list that pulls the first pushed item first', async () => {
    const { createFifoList } = await import('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.pull()).toBe(item1) // First in, first out
  })

  it('creates a FIFO list that no longer counts a pulled item', async () => {
    const { createFifoList } = await import('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)
    list.pull()

    expect(list.size()).toBe(1)
  })

  it('exports createLifoList function', async () => {
    const { createLifoList } = await import('@hyperfrontend/list-utils')
    expect(typeof createLifoList).toBe('function')
  })

  it('creates a LIFO list that counts every pushed item', async () => {
    const { createLifoList } = await import('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
  })

  it('creates a LIFO list that pulls the last pushed item first', async () => {
    const { createLifoList } = await import('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.pull()).toBe(item2) // Last in, first out
  })

  it('creates a LIFO list that no longer counts a pulled item', async () => {
    const { createLifoList } = await import('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)
    list.pull()

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

describe('@hyperfrontend/list-utils ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.mjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('orders, ranges, filters and cycles lists', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      fifo: [true, 1],
      lifo: [true, 1],
      range: [1, 2, 3, 4],
      unique: ['a', 'b'],
      nonEmpty: ['a', 'b'],
      picks: ['red', 'green', 'red'],
    })
  })
})
