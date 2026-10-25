/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/json-utils`
 * Tests that the package is importable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'

import type { Schema } from '@hyperfrontend/json-utils'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/json-utils'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { createValidator, isEqual, toJsonSchema, validate } from '@hyperfrontend/json-utils'",
  'async function main() {',
  "  const schema = { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name'] }",
  "  const isString = createValidator({ type: 'string' })",
  '  return {',
  "    valid: validate({ name: 'Ada', age: 36 }, schema).valid,",
  '    invalid: validate({ age: 36 }, schema).valid,',
  "    reusable: [isString('hello').valid, isString(1).valid],",
  "    generated: toJsonSchema({ name: 'Ada', age: 36 }).type,",
  '    equal: isEqual({ a: [1] }, { a: [1] }),',
  '  }',
  '}',
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/json-utils ESM', () => {
  it('is importable', async () => {
    const jsonUtils = await import('@hyperfrontend/json-utils')
    expect(jsonUtils).toBeDefined()
  })

  it('exports validate function', async () => {
    const { validate } = await import('@hyperfrontend/json-utils')
    expect(typeof validate).toBe('function')
  })

  it('validates data that satisfies a schema as valid', async () => {
    const { validate } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    }

    const validData = { name: 'John', age: 30 }

    const validResult = validate(validData, schema)
    expect(validResult.valid).toBe(true)
  })

  it('validates data missing a required property as invalid', async () => {
    const { validate } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    }

    const invalidData = { age: 30 }

    const invalidResult = validate(invalidData, schema)
    expect(invalidResult.valid).toBe(false)
  })

  it('exports createValidator function', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')
    expect(typeof createValidator).toBe('function')
  })

  it('creates a reusable validator as a function', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'string',
    }

    const validator = createValidator(schema)
    expect(typeof validator).toBe('function')
  })

  it('creates a reusable validator that accepts data matching its schema', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'string',
    }

    const validator = createValidator(schema)

    const result = validator('hello')
    expect(result.valid).toBe(true)
  })

  it('exports toJsonSchema function', async () => {
    const { toJsonSchema } = await import('@hyperfrontend/json-utils')
    expect(typeof toJsonSchema).toBe('function')
  })

  it('generates JSON schema from data', async () => {
    const { toJsonSchema } = await import('@hyperfrontend/json-utils')

    const data = { name: 'John', age: 30 }
    const schema = toJsonSchema(data)

    expect(schema).toEqual(expect.objectContaining({ type: 'object', properties: expect.anything() }))
  })
})

describe('@hyperfrontend/json-utils ESM under plain Node in an isolated consumer', () => {
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

  it('validates against a schema and generates one from data', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      valid: true,
      invalid: false,
      reusable: [true, false],
      generated: 'object',
      equal: true,
    })
  })
})
