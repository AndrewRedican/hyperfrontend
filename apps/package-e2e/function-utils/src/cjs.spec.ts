/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/function-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/function-utils CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/function-utils')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        createRunOnceFunction: 'function',
        noop: 'function',
        createErrorIgnoringFunction: 'function',
        createConditionalExecutionFunction: 'function',
      })
    )
  })

  it('returns the first result from every call of a run-once function', () => {
    const results = consumer.run(
      async () => {
        const { createRunOnceFunction } = require('@hyperfrontend/function-utils')
        const once = createRunOnceFunction(() => 'result')
        return [once(), once()]
      },
      { kind: 'require' }
    )
    expect(results).toEqual(['result', 'result'])
  })

  it('executes a run-once function only once', () => {
    const runs = consumer.run(
      async () => {
        const { createRunOnceFunction } = require('@hyperfrontend/function-utils')
        let count = 0
        const once = createRunOnceFunction(() => {
          count += 1
        })
        once()
        once()
        return count
      },
      { kind: 'require' }
    )
    expect(runs).toBe(1)
  })

  it('returns undefined from noop', () => {
    const result = consumer.run(
      async () => {
        const { noop } = require('@hyperfrontend/function-utils')
        return noop() === undefined
      },
      { kind: 'require' }
    )
    expect(result).toBe(true)
  })

  it('swallows the error an error-ignoring function target throws', () => {
    const outcome = consumer.run(
      async () => {
        const { createErrorIgnoringFunction } = require('@hyperfrontend/function-utils')
        const guarded = createErrorIgnoringFunction(() => {
          throw new Error('test error')
        })
        guarded()
        return 'swallowed'
      },
      { kind: 'require' }
    )
    expect(outcome).toBe('swallowed')
  })

  it('executes a conditional function target when the condition holds', () => {
    const executed = consumer.run(
      async () => {
        const { createConditionalExecutionFunction } = require('@hyperfrontend/function-utils')
        let executed = false
        createConditionalExecutionFunction(
          () => {
            executed = true
          },
          () => true
        )()
        return executed
      },
      { kind: 'require' }
    )
    expect(executed).toBe(true)
  })

  it('skips a conditional function target when the condition fails', () => {
    const executed = consumer.run(
      async () => {
        const { createConditionalExecutionFunction } = require('@hyperfrontend/function-utils')
        let executed = false
        createConditionalExecutionFunction(
          () => {
            executed = true
          },
          () => false
        )()
        return executed
      },
      { kind: 'require' }
    )
    expect(executed).toBe(false)
  })
})
