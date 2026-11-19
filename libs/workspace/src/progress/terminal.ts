/**
 * Where the progress of a run is written: finished lines, and on a terminal that can rewrite a
 * line, a status that the next line replaces. Output that is not a terminal, or that asked for no
 * colour, gets plain lines alone.
 *
 * @module progress/terminal
 */

import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The ways a piece of text is set apart on a terminal. */
export const Style = freeze({
  Green: '32',
  Red: '31',
  Yellow: '33',
  Dim: '2',
  Bold: '1',
} as const)

/** One of the styles. */
export type Style = (typeof Style)[keyof typeof Style]

/** A stream the progress is written to, as far as it is read here. */
export interface ProgressSink {
  /** Writes text. */
  write(text: string): unknown
  /** Whether the stream is a terminal. */
  readonly isTTY?: boolean
  /** The width of the terminal, in columns. */
  readonly columns?: number
}

/** The lines and the status of a run, as the view writes them. */
export interface Terminal {
  /** Whether the output takes plain lines alone: no colour, and no line rewritten in place. */
  readonly plain: boolean
  /** Writes a finished line, in place of the status when one is shown. */
  readonly line: (text: string) => void
  /** Shows a status the next line or status replaces; writes nothing on plain output. */
  readonly status: (text: string) => void
  /** Sets text apart in a style; the text itself on plain output. */
  readonly paint: (text: string, style: Style) => string
}

/** The sequence that returns to the start of the line and erases it. */
const ERASE_LINE = '\r\u001B[2K'

/** The width assumed for a terminal that does not report one. */
const DEFAULT_COLUMNS = 80

/**
 * The terminal a stream is: plain unless the stream is a terminal that can rewrite a line and the
 * environment did not ask for output without colour.
 *
 * @param sink - The stream written to
 * @param env - The environment: `NO_COLOR` set to anything, or a `TERM` of `dumb`, asks for plain output
 * @returns How lines and the status are written to it
 *
 * @example A stream that is not a terminal gets plain lines and no status
 * ```typescript
 * import { createTerminal, Style } from '@hyperfrontend/workspace/runner'
 *
 * const terminal = createTerminal(process.stderr, process.env)
 * terminal.status('lib-core:build 42s')
 * terminal.line(`${terminal.paint('✓', Style.Green)} lib-core:build`)
 * // through a pipe: writes '✓ lib-core:build\n' and nothing for the status
 * ```
 */
export function createTerminal(sink: ProgressSink, env: Readonly<Record<string, string | undefined>>): Terminal {
  const plain = sink.isTTY !== true || (env['NO_COLOR'] ?? '') !== '' || env['TERM'] === 'dumb'
  let shown = false
  return {
    plain,
    line: (text) => {
      sink.write(`${shown ? ERASE_LINE : ''}${text}\n`)
      shown = false
    },
    status: (text) => {
      if (plain) return
      // why: a terminal with no size reports none or zero columns
      const columns = sink.columns === undefined || sink.columns < 2 ? DEFAULT_COLUMNS : sink.columns
      // why: a status wider than the terminal wraps, and the erase that follows clears only its last row
      sink.write(`${ERASE_LINE}${text.slice(0, columns - 1)}`)
      shown = true
    },
    paint: (text, style) => (plain ? text : `\u001B[${style}m${text}\u001B[0m`),
  }
}
