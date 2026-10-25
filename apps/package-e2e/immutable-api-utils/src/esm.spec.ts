/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/immutable-api-utils`
 * Tests that the package is importable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/immutable-api-utils'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { lockedPropertyDescriptors, lockedProps } from '@hyperfrontend/immutable-api-utils'",
  "import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'",
  "import { locked } from '@hyperfrontend/immutable-api-utils/locked'",
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
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/immutable-api-utils ESM', () => {
  it('is importable', async () => {
    const immutableApiUtils = await import('@hyperfrontend/immutable-api-utils')
    expect(immutableApiUtils).toBeDefined()
  })

  it('exports lockedPropertyDescriptors', async () => {
    const { lockedPropertyDescriptors } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedPropertyDescriptors).toBe('function')
  })

  it('creates locked property descriptors', async () => {
    const { lockedPropertyDescriptors } = await import('@hyperfrontend/immutable-api-utils')

    const descriptor = lockedPropertyDescriptors('test-value')
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('exports lockedProps', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedProps).toBe('function')
  })

  it('locks properties on an object with the given values', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')

    const obj: Record<string, unknown> = {}
    lockedProps(obj, [
      ['foo', 'bar'],
      ['num', 42],
    ])

    expect({ foo: obj.foo, num: obj.num }).toEqual({ foo: 'bar', num: 42 })
  })

  it('locks properties on an object against reassignment', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')

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

  it('exports locked decorator', async () => {
    const { locked } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof locked).toBe('function')
  })
})

describe('@hyperfrontend/immutable-api-utils ESM under plain Node in an isolated consumer', () => {
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

  it('locks properties and freezes through the built-in copies', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
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
