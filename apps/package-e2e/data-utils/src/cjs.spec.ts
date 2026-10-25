/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/data-utils`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/data-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { getDepth, getType, hasCircularReference, isIdentical, sameType } = require('@hyperfrontend/data-utils')",
  'async function main() {',
  '  const ring = { a: 1 }',
  '  const before = hasCircularReference(ring)',
  '  ring.self = ring',
  '  return {',
  "    types: [getType('x'), getType(1), getType(null), getType([]), getType({})],",
  '    identical: isIdentical({ a: [1, 2] }, { a: [1, 2] }),',
  '    different: isIdentical({ a: 1 }, { a: 2 }),',
  "    shared: sameType('a', 'b'),",
  "    mixed: sameType('a', 1),",
  '    circular: [before, hasCircularReference(ring)],',
  '    depth: getDepth({ a: { b: { c: 1 } } }),',
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/data-utils CJS', () => {
  it('is requireable', () => {
    const dataUtils = require('@hyperfrontend/data-utils')
    expect(dataUtils).toBeDefined()
  })

  it('exports getType function', () => {
    const { getType } = require('@hyperfrontend/data-utils')
    expect(typeof getType).toBe('function')
  })

  it.each([
    ['hello', 'string'],
    [123, 'number'],
    [true, 'boolean'],
    [null, 'null'],
    [undefined, 'undefined'],
    [[], 'array'],
    [{}, 'object'],
  ])('detects the type of %p as %s', (input, expected) => {
    const { getType } = require('@hyperfrontend/data-utils')

    expect(getType(input)).toBe(expected)
  })

  it('exports isIdentical function', () => {
    const { isIdentical } = require('@hyperfrontend/data-utils')
    expect(typeof isIdentical).toBe('function')
  })

  it('detects structurally equal objects as identical', () => {
    const { isIdentical } = require('@hyperfrontend/data-utils')

    expect(isIdentical({ a: 1 }, { a: 1 })).toBe(true)
  })

  it('detects objects with different values as not identical', () => {
    const { isIdentical } = require('@hyperfrontend/data-utils')

    expect(isIdentical({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('detects structurally equal arrays as identical', () => {
    const { isIdentical } = require('@hyperfrontend/data-utils')

    expect(isIdentical([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('exports sameType function', () => {
    const { sameType } = require('@hyperfrontend/data-utils')
    expect(typeof sameType).toBe('function')
  })

  it('names the type two strings share through sameType', () => {
    const { sameType } = require('@hyperfrontend/data-utils')

    expect(sameType('hello', 'world')).toBe('string')
  })

  it('returns false from sameType for a string and a number', () => {
    const { sameType } = require('@hyperfrontend/data-utils')

    expect(sameType('hello', 123)).toBe(false)
  })

  it('exports traverse function', () => {
    const { traverse } = require('@hyperfrontend/data-utils')
    expect(typeof traverse).toBe('function')
  })

  it('exports selectiveCopy function', () => {
    const { selectiveCopy } = require('@hyperfrontend/data-utils')
    expect(typeof selectiveCopy).toBe('function')
  })

  it('exports hasCircularReference function', () => {
    const { hasCircularReference } = require('@hyperfrontend/data-utils')
    expect(typeof hasCircularReference).toBe('function')
  })

  it('reports a circular reference only once the object references itself', () => {
    const { hasCircularReference } = require('@hyperfrontend/data-utils')

    const obj: Record<string, unknown> = { a: 1 }
    const beforeSelfReference = hasCircularReference(obj)

    obj.self = obj
    const afterSelfReference = hasCircularReference(obj)

    expect({ beforeSelfReference, afterSelfReference }).toEqual({ beforeSelfReference: false, afterSelfReference: true })
  })

  it('exports getDepth function', () => {
    const { getDepth } = require('@hyperfrontend/data-utils')
    expect(typeof getDepth).toBe('function')
  })

  it('exports locateKey function', () => {
    const { locateKey } = require('@hyperfrontend/data-utils')
    expect(typeof locateKey).toBe('function')
  })
})

describe('@hyperfrontend/data-utils CJS under plain Node in an isolated consumer', () => {
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

  it('classifies, compares and measures values', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      types: ['string', 'number', 'null', 'array', 'object'],
      identical: true,
      different: false,
      shared: 'string',
      mixed: false,
      circular: [false, true],
      depth: [3, [['a', 'b', 'c']]],
    })
  })
})
