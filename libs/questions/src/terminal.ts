/**
 * Terminal I/O utilities using Node.js readline.
 *
 * @internal
 */
import { createInterface } from 'node:readline'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Key codes for terminal navigation.
 */
export const Key = freeze(<const>{
  Up: '\x1B[A',
  Down: '\x1B[B',
  Left: '\x1B[D',
  Right: '\x1B[C',
  Enter: '\r',
  Space: ' ',
  Tab: '\t',
  Escape: '\x1B',
  Backspace: '\x7F',
  Delete: '\x1B[3~',
  CtrlC: '\x03',
})

/** Terminal key code type. */
export type Key = (typeof Key)[keyof typeof Key]

/**
 * ANSI escape codes for terminal styling.
 */
export const Ansi = freeze(<const>{
  /** Clear entire line */
  ClearLine: '\x1B[2K',
  /** Move cursor to start of line */
  CursorStart: '\r',
  /**
   * Generates ANSI escape code to move cursor up by specified lines.
   *
   * @param n - Number of lines to move up
   * @returns ANSI escape sequence string
   */
  cursorUp: (n: number): string => `\x1B[${n}A`,
  /**
   * Generates ANSI escape code to move cursor down by specified lines.
   *
   * @param n - Number of lines to move down
   * @returns ANSI escape sequence string
   */
  cursorDown: (n: number): string => `\x1B[${n}B`,
  /**
   * Generates ANSI escape code to move cursor left by specified columns.
   *
   * @param n - Number of columns to move left
   * @returns ANSI escape sequence string
   */
  cursorLeft: (n: number): string => `\x1B[${n}D`,
  /** Escape code to hide cursor */
  HideCursor: '\x1B[?25l',
  /** Escape code to show cursor */
  ShowCursor: '\x1B[?25h',
  /** Escape code to save cursor position */
  SaveCursor: '\x1B7',
  /** Escape code to restore cursor position */
  RestoreCursor: '\x1B8',
  /** Clear from cursor to end of screen */
  ClearToEnd: '\x1B[J',
  /** Escape code for bold text */
  Bold: '\x1B[1m',
  /** Escape code for dim text */
  Dim: '\x1B[2m',
  /** Escape code to reset all styles */
  Reset: '\x1B[0m',
  /** Escape code for cyan foreground */
  Cyan: '\x1B[36m',
  /** Escape code for green foreground */
  Green: '\x1B[32m',
  /** Escape code for yellow foreground */
  Yellow: '\x1B[33m',
  /** Escape code for red foreground */
  Red: '\x1B[31m',
  /** Escape code for gray foreground */
  Gray: '\x1B[90m',
})

/**
 * Terminal interface configuration.
 */
export interface TerminalConfig {
  /** Stream to read input from */
  readonly input?: NodeJS.ReadStream
  /** Stream to write output to */
  readonly output?: NodeJS.WriteStream
}

/**
 * Terminal interface for interactive prompts.
 */
export interface Terminal {
  /** Write text to output */
  readonly write: (text: string) => void
  /** Read a single keypress */
  readonly readKey: () => Promise<string>
  /** Read a line of text */
  readonly readLine: () => Promise<string>
  /** Clear N lines from current position */
  readonly clearLines: (count: number) => void
  /** Close the terminal interface */
  readonly close: () => void
  /** Check if cancelled (Ctrl+C pressed) */
  readonly isCancelled: () => boolean
  /** Set cancelled state */
  readonly cancel: () => void
}

/**
 * Creates a terminal interface for interactive prompts.
 *
 * @param config - Terminal configuration options
 * @returns Terminal interface with read/write methods
 *
 * @example Create terminal for prompts
 * ```typescript
 * const term = createTerminal()
 * term.write('Enter name: ')
 * const name = await term.readLine()
 * term.close()
 * ```
 */
export function createTerminal(config: TerminalConfig = {}): Terminal {
  const input = config.input ?? process.stdin
  const output = config.output ?? process.stdout

  let cancelled = false
  let rl: ReturnType<typeof createInterface> | undefined

  const getReadline = (): ReturnType<typeof createInterface> => {
    if (!rl) {
      rl = createInterface({ input, output, terminal: true })
    }
    return rl
  }

  const write = (text: string): void => {
    output.write(text)
  }

  const readKey = (): Promise<string> =>
    createPromise((resolve) => {
      const wasRaw = input.isRaw
      if (input.setRawMode) {
        input.setRawMode(true)
      }

      const onData = (data: Buffer): void => {
        input.removeListener('data', onData)
        if (input.setRawMode) {
          input.setRawMode(wasRaw)
        }
        const key = data.toString()
        if (key === Key.CtrlC) {
          cancelled = true
        }
        resolve(key)
      }

      input.once('data', onData)
    })

  const readLine = (): Promise<string> =>
    createPromise((resolve) => {
      const readline = getReadline()
      readline.once('line', (line: string) => {
        resolve(line)
      })
      readline.once('close', () => {
        cancelled = true
        resolve('')
      })
    })

  const clearLines = (count: number): void => {
    if (count <= 0) return
    for (let i = 0; i < count; i++) {
      write(Ansi.CursorStart + Ansi.ClearLine)
      if (i < count - 1) {
        write(Ansi.cursorUp(1))
      }
    }
  }

  const close = (): void => {
    if (rl) {
      rl.close()
      rl = undefined
    }
    write(Ansi.ShowCursor)
  }

  return freeze({
    write,
    readKey,
    readLine,
    clearLines,
    close,
    isCancelled: () => cancelled,
    cancel: () => {
      cancelled = true
    },
  })
}
