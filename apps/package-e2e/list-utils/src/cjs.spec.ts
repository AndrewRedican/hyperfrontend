/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/list-utils`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, expect, it } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/list-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { createFifoList, createLifoList, createRange, createValuePicker, nonEmptyStrings, uniqueStrings } = require('@hyperfrontend/list-utils')",
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
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/list-utils CJS', () => {
  it('is requireable', () => {
    const listUtils = require('@hyperfrontend/list-utils')
    expect(listUtils).toBeDefined()
  })

  it('exports createFifoList function', () => {
    const { createFifoList } = require('@hyperfrontend/list-utils')
    expect(typeof createFifoList).toBe('function')
  })

  it('creates a FIFO list that counts every pushed item', () => {
    const { createFifoList } = require('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
  })

  it('creates a FIFO list that pulls the first pushed item first', () => {
    const { createFifoList } = require('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.pull()).toBe(item1) // First in, first out
  })

  it('creates a FIFO list that no longer counts a pulled item', () => {
    const { createFifoList } = require('@hyperfrontend/list-utils')

    const list = createFifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)
    list.pull()

    expect(list.size()).toBe(1)
  })

  it('exports createLifoList function', () => {
    const { createLifoList } = require('@hyperfrontend/list-utils')
    expect(typeof createLifoList).toBe('function')
  })

  it('creates a LIFO list that counts every pushed item', () => {
    const { createLifoList } = require('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.size()).toBe(2)
  })

  it('creates a LIFO list that pulls the last pushed item first', () => {
    const { createLifoList } = require('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)

    expect(list.pull()).toBe(item2) // Last in, first out
  })

  it('creates a LIFO list that no longer counts a pulled item', () => {
    const { createLifoList } = require('@hyperfrontend/list-utils')

    const list = createLifoList()
    const item1 = { id: 1 }
    const item2 = { id: 2 }

    list.push(item1)
    list.push(item2)
    list.pull()

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

describe('@hyperfrontend/list-utils CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.cjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('orders, ranges, filters and cycles lists', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
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
