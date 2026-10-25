/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/function-utils`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/function-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { createConditionalExecutionFunction, createErrorIgnoringFunction, createRunOnceFunction, noop } = require('@hyperfrontend/function-utils')",
  'async function main() {',
  '  let runs = 0',
  '  const once = createRunOnceFunction(() => {',
  '    runs += 1',
  "    return 'result'",
  '  })',
  '  const results = [once(), once()]',
  '  const guarded = createErrorIgnoringFunction(() => {',
  "    throw new Error('boom')",
  '  })',
  '  let threw = false',
  '  try {',
  '    guarded()',
  '  } catch {',
  '    threw = true',
  '  }',
  '  let executed = 0',
  '  createConditionalExecutionFunction(() => {',
  '    executed += 1',
  '  }, () => true)()',
  '  createConditionalExecutionFunction(() => {',
  '    executed += 1',
  '  }, () => false)()',
  '  return { results, runs, noopReturnsUndefined: noop() === undefined, threw, executed }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/function-utils CJS', () => {
  it('is requireable', () => {
    const functionUtils = require('@hyperfrontend/function-utils')
    expect(functionUtils).toBeDefined()
  })

  it('exports createRunOnceFunction', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createRunOnceFunction).toBe('function')
  })

  it('creates a run-once function that returns the result on every call', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')

    const fn = createRunOnceFunction(() => 'result')

    const firstCall = fn()
    const secondCall = fn()

    expect({ firstCall, secondCall }).toEqual({ firstCall: 'result', secondCall: 'result' })
  })

  it('creates a run-once function that executes only once', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')

    let callCount = 0
    const fn = createRunOnceFunction(() => {
      callCount++
      return 'result'
    })

    fn()
    fn()

    expect(callCount).toBe(1)
  })

  it('exports noop', () => {
    const { noop } = require('@hyperfrontend/function-utils')
    expect(typeof noop).toBe('function')
  })

  it('returns undefined from noop', () => {
    const { noop } = require('@hyperfrontend/function-utils')
    expect(noop()).toBeUndefined()
  })

  it('exports createErrorIgnoringFunction', () => {
    const { createErrorIgnoringFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createErrorIgnoringFunction).toBe('function')
  })

  it('creates an error-ignoring function that swallows the error its target throws', () => {
    const { createErrorIgnoringFunction } = require('@hyperfrontend/function-utils')

    const safeFn = createErrorIgnoringFunction(() => {
      throw new Error('test error')
    })
    expect(() => safeFn()).not.toThrow()
  })

  it('exports createConditionalExecutionFunction', () => {
    const { createConditionalExecutionFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createConditionalExecutionFunction).toBe('function')
  })

  it('creates a conditional function that executes its target when the condition holds', () => {
    const { createConditionalExecutionFunction } = require('@hyperfrontend/function-utils')

    let executed = false
    const conditionalFn = createConditionalExecutionFunction(
      () => {
        executed = true
      },
      () => true
    )
    conditionalFn()
    expect(executed).toBe(true)
  })
})

describe('@hyperfrontend/function-utils CJS under plain Node in an isolated consumer', () => {
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

  it('wraps functions to run once, ignore errors and run conditionally', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      results: ['result', 'result'],
      runs: 1,
      noopReturnsUndefined: true,
      threw: false,
      executed: 1,
    })
  })
})
