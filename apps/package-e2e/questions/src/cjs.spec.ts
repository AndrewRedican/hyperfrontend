/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/questions`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/questions CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/questions')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
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
    const results = consumer.run(
      async () => {
        const { PromptResult } = require('@hyperfrontend/questions')
        return PromptResult
      },
      { kind: 'require' }
    )
    expect(results).toEqual({
      Submitted: 'submitted',
      Cancelled: 'cancelled',
    })
  })

  it('wraps text in terminal styling codes', () => {
    const styled = consumer.run(
      async () => {
        const { style } = require('@hyperfrontend/questions')
        return [style.bold('x').includes('x'), style.bold('x') === 'x']
      },
      { kind: 'require' }
    )
    expect(styled).toEqual([true, false])
  })

  it('answers a confirm prompt driven through a terminal stream', () => {
    const outcome = consumer.run(
      async () => {
        const { confirm } = require('@hyperfrontend/questions')
        const { PassThrough } = require('node:stream')
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
      },
      { kind: 'require' }
    )
    expect(outcome).toEqual({
      result: 'submitted',
      value: true,
      asked: true,
    })
  })
})
