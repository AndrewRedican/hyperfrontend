/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/questions`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/questions ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/questions')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        confirm: 'function',
        select: 'function',
        multiselect: 'function',
        text: 'function',
        style: 'object',
        PromptResult: 'object',
      })
    )
  })

  it('names the two prompt outcomes', () => {
    const results = consumer.run(async () => {
      const { PromptResult } = await import('@hyperfrontend/questions')
      return PromptResult
    })
    expect(results).toEqual({
      Submitted: 'submitted',
      Cancelled: 'cancelled',
    })
  })

  it('wraps text in terminal styling codes', () => {
    const styled = consumer.run(async () => {
      const { style } = await import('@hyperfrontend/questions')
      return [style.bold('x').includes('x'), style.bold('x') === 'x']
    })
    expect(styled).toEqual([true, false])
  })

  it('answers a confirm prompt driven through a terminal stream', () => {
    const outcome = consumer.run(async () => {
      const { confirm } = await import('@hyperfrontend/questions')
      const { PassThrough } = await import('node:stream')
      const input = Object.assign(new PassThrough(), {
        isTTY: true,
        isRaw: false,
        setRawMode: (mode: boolean) => Object.assign(input, { isRaw: mode }),
      })
      const written: string[] = []
      const output = Object.assign(new PassThrough(), { isTTY: true, columns: 80, rows: 24 })
      output.on('data', (chunk: Buffer) => written.push(chunk.toString()))
      const pending = confirm({
        message: 'Continue?',
        input: input as unknown as NodeJS.ReadStream,
        output: output as unknown as NodeJS.WriteStream,
      })
      setImmediate(() => input.write('y'))
      const answer = await pending
      return { result: answer.result, value: answer.value, asked: written.join('').includes('Continue?') }
    })
    expect(outcome).toEqual({
      result: 'submitted',
      value: true,
      asked: true,
    })
  })
})
