/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/immutable-api-utils`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/immutable-api-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { lockedPropertyDescriptors, lockedProps } = require('@hyperfrontend/immutable-api-utils')",
  "const { freeze } = require('@hyperfrontend/immutable-api-utils/built-in-copy/object')",
  "const { locked } = require('@hyperfrontend/immutable-api-utils/locked')",
  'async function main() {',
  '  const target = {}',
  '  lockedProps(target, [',
  "    ['foo', 'bar'],",
  "    ['num', 42],",
  '  ])',
  "  let reassigned = 'allowed'",
  '  try {',
  "    target.foo = 'changed'",
  '  } catch {',
  "    reassigned = 'refused'",
  '  }',
  '  return {',
  "    descriptor: lockedPropertyDescriptors('v'),",
  '    values: [target.foo, target.num],',
  '    reassigned,',
  '    frozen: Object.isFrozen(freeze({ a: 1 })),',
  "    lockedIsFunction: typeof locked === 'function',",
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/immutable-api-utils CJS', () => {
  it('is requireable', () => {
    const immutableApiUtils = require('@hyperfrontend/immutable-api-utils')
    expect(immutableApiUtils).toBeDefined()
  })

  it('exports lockedPropertyDescriptors', () => {
    const { lockedPropertyDescriptors } = require('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedPropertyDescriptors).toBe('function')
  })

  it('creates locked property descriptors', () => {
    const { lockedPropertyDescriptors } = require('@hyperfrontend/immutable-api-utils')

    const descriptor = lockedPropertyDescriptors('test-value')
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('exports lockedProps', () => {
    const { lockedProps } = require('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedProps).toBe('function')
  })

  it('locks properties on an object with the given values', () => {
    const { lockedProps } = require('@hyperfrontend/immutable-api-utils')

    const obj: Record<string, unknown> = {}
    lockedProps(obj, [
      ['foo', 'bar'],
      ['num', 42],
    ])

    expect({ foo: obj.foo, num: obj.num }).toEqual({ foo: 'bar', num: 42 })
  })

  it('locks properties on an object against reassignment', () => {
    const { lockedProps } = require('@hyperfrontend/immutable-api-utils')

    const obj: Record<string, unknown> = {}
    lockedProps(obj, [
      ['foo', 'bar'],
      ['num', 42],
    ])

    // Should not be writable
    expect(() => {
      obj.foo = 'changed'
    }).toThrow()
  })

  it('exports locked decorator', () => {
    const { locked } = require('@hyperfrontend/immutable-api-utils')
    expect(typeof locked).toBe('function')
  })
})

describe('@hyperfrontend/immutable-api-utils CJS under plain Node in an isolated consumer', () => {
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

  it('locks properties and freezes through the built-in copies', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      descriptor: {
        value: 'v',
        writable: false,
        configurable: false,
        enumerable: false,
      },
      values: ['bar', 42],
      reassigned: 'refused',
      frozen: true,
      lockedIsFunction: true,
    })
  })
})
