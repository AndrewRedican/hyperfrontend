import type { ProgressSink } from './terminal'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTerminal, Style } from './terminal'

/** A stream that keeps what is written to it. */
interface Kept extends ProgressSink {
  /** Everything written, in order. */
  readonly written: string[]
}

/**
 * A stream that keeps what is written to it.
 *
 * @param shape - Whether it is a terminal, and how wide
 * @returns The stream
 */
function sink(shape: Omit<ProgressSink, 'write'> = {}): Kept {
  const written: string[] = []
  return { ...shape, written, write: (text) => written.push(text) }
}

describe('createTerminal', () => {
  it.each([
    ['a stream that is not a terminal', {}, {}],
    ['a terminal asked for no colour', { isTTY: true }, { NO_COLOR: '1' }],
    ['a terminal that cannot rewrite a line', { isTTY: true }, { TERM: 'dumb' }],
  ])('is plain for %s', (_, shape, env) => {
    expect(createTerminal(sink(shape), env).plain).toBe(true)
  })

  it('is not plain for a terminal whose NO_COLOR is empty', () => {
    expect(createTerminal(sink({ isTTY: true }), { NO_COLOR: '', TERM: 'xterm' }).plain).toBe(false)
  })

  it('writes a line with its newline', () => {
    const out = sink()
    createTerminal(out, {}).line('done')
    expect(out.written).toEqual(['done\n'])
  })

  it('writes no status and no style on plain output', () => {
    const out = sink()
    const terminal = createTerminal(out, {})
    terminal.status('running')
    terminal.line(terminal.paint('done', Style.Green))
    expect(out.written).toEqual(['done\n'])
  })

  it('rewrites the status in place and replaces it with the next line', () => {
    const out = sink({ isTTY: true, columns: 40 })
    const terminal = createTerminal(out, {})
    terminal.status('one')
    terminal.status('two')
    terminal.line('done')
    terminal.line('next')
    expect(out.written).toEqual(['\r\u001B[2Kone', '\r\u001B[2Ktwo', '\r\u001B[2Kdone\n', 'next\n'])
  })

  it('cuts the status short of the width so it never wraps', () => {
    const out = sink({ isTTY: true, columns: 6 })
    createTerminal(out, {}).status('lib-core:build')
    expect(out.written).toEqual(['\r\u001B[2Klib-c'])
  })

  it.each([
    ['no width', {}],
    ['a width of zero', { columns: 0 }],
  ])('takes a terminal that reports %s as 80 columns wide', (_, shape) => {
    const out = sink({ isTTY: true, ...shape })
    createTerminal(out, {}).status('x'.repeat(100))
    expect(out.written).toEqual([`\r\u001B[2K${'x'.repeat(79)}`])
  })

  it('sets text apart in a style on a terminal', () => {
    expect(createTerminal(sink({ isTTY: true }), {}).paint('ok', Style.Green)).toBe('\u001B[32mok\u001B[0m')
  })
})
