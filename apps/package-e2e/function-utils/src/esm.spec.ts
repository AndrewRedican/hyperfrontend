/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/function-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/function-utils ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/function-utils')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
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
    const results = consumer.run(async () => {
      const { createRunOnceFunction } = await import('@hyperfrontend/function-utils')
      const once = createRunOnceFunction(() => 'result')
      return [once(), once()]
    })
    expect(results).toEqual(['result', 'result'])
  })

  it('executes a run-once function only once', () => {
    const runs = consumer.run(async () => {
      const { createRunOnceFunction } = await import('@hyperfrontend/function-utils')
      let count = 0
      const once = createRunOnceFunction(() => {
        count += 1
      })
      once()
      once()
      return count
    })
    expect(runs).toBe(1)
  })

  it('returns undefined from noop', () => {
    const result = consumer.run(async () => {
      const { noop } = await import('@hyperfrontend/function-utils')
      return noop() === undefined
    })
    expect(result).toBe(true)
  })

  it('swallows the error an error-ignoring function target throws', () => {
    const outcome = consumer.run(async () => {
      const { createErrorIgnoringFunction } = await import('@hyperfrontend/function-utils')
      const guarded = createErrorIgnoringFunction(() => {
        throw new Error('test error')
      })
      guarded()
      return 'swallowed'
    })
    expect(outcome).toBe('swallowed')
  })

  it('executes a conditional function target when the condition holds', () => {
    const executed = consumer.run(async () => {
      const { createConditionalExecutionFunction } = await import('@hyperfrontend/function-utils')
      let executed = false
      createConditionalExecutionFunction(
        () => {
          executed = true
        },
        () => true
      )()
      return executed
    })
    expect(executed).toBe(true)
  })

  it('skips a conditional function target when the condition fails', () => {
    const executed = consumer.run(async () => {
      const { createConditionalExecutionFunction } = await import('@hyperfrontend/function-utils')
      let executed = false
      createConditionalExecutionFunction(
        () => {
          executed = true
        },
        () => false
      )()
      return executed
    })
    expect(executed).toBe(false)
  })
})
