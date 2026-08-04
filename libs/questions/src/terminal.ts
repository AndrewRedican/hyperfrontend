/**
 * Terminal I/O utilities using Node.js readline.
 *
 * @internal
 */
import type { InputToken } from './token-parser'
import { createInterface } from 'node:readline'
import { StringDecoder } from 'node:string_decoder'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createTokenParser, TokenType } from './token-parser'

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
  /**
   * Generates ANSI escape code to move cursor right by specified columns.
   *
   * @param n - Number of columns to move right
   * @returns ANSI escape sequence string
   */
  cursorRight: (n: number): string => `\x1B[${n}C`,
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
  /** Ask the terminal to wrap pasted text in ESC[200~ / ESC[201~ markers */
  BracketedPasteOn: '\x1B[?2004h',
  /** Stop wrapping pasted text in bracketed-paste markers */
  BracketedPasteOff: '\x1B[?2004l',
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
 * Current terminal dimensions.
 */
export interface TerminalSize {
  /** Number of columns, defaulting to 80 when the output reports none */
  readonly columns: number
  /** Number of rows, defaulting to 24 when the output reports none */
  readonly rows: number
}

/**
 * Terminal interface for interactive prompts.
 */
export interface Terminal {
  /** Write text to output */
  readonly write: (text: string) => void
  /** Read the next key or paste value, skipping resize notifications */
  readonly readKey: () => Promise<string>
  /** Read the next input token: a key, a paste, or a resize notification */
  readonly readToken: () => Promise<InputToken>
  /** Read a line of text */
  readonly readLine: () => Promise<string>
  /** Clear N lines from current position */
  readonly clearLines: (count: number) => void
  /** Current output dimensions */
  readonly getSize: () => TerminalSize
  /** Close the terminal interface, restoring the input's original raw mode */
  readonly close: () => void
  /** Check if cancelled (Ctrl+C pressed) */
  readonly isCancelled: () => boolean
  /** Set cancelled state */
  readonly cancel: () => void
}

/**
 * Creates a terminal interface for interactive prompts.
 *
 * The first `readToken`/`readKey` call opens a read session: the input is
 * switched to raw mode for the whole session (restored on `close`),
 * bracketed paste mode is enabled on TTY inputs, and resize events from the
 * output surface as resize tokens. Input chunks are tokenized by a
 * persistent listener so no chunk is lost between reads.
 *
 * @param config - Terminal configuration options
 * @returns Terminal interface with read/write methods
 *
 * @example Create terminal for prompts
 * ```typescript
 * const term = createTerminal()
 * term.write('Enter name: ')
 * const token = await term.readToken()
 * term.close()
 * ```
 */
export function createTerminal(config: TerminalConfig = {}): Terminal {
  const input = config.input ?? process.stdin
  const output = config.output ?? process.stdout

  let cancelled = false
  let closed = false
  let sessionActive = false
  let savedRawMode = false
  let rl: ReturnType<typeof createInterface> | undefined
  let pendingWaiter: ((token: InputToken) => void) | undefined
  const parser = createTokenParser()
  // why: decoding through StringDecoder keeps multibyte characters intact when a large paste is split across stream chunks mid-code-point
  const decoder = new StringDecoder('utf8')
  const tokenQueue: InputToken[] = []

  const getReadline = (): ReturnType<typeof createInterface> => {
    if (!rl) {
      rl = createInterface({ input, output, terminal: true })
    }
    return rl
  }

  const write = (text: string): void => {
    output.write(text)
  }

  const deliver = (tokens: ReadonlyArray<InputToken>): void => {
    for (const token of tokens) {
      if (token.type === TokenType.Key && token.value === Key.CtrlC) {
        cancelled = true
      }
      // why: a resize drag fires many events; consecutive notifications collapse into one so the prompt repaints once per drained batch
      if (token.type === TokenType.Resize && tokenQueue[tokenQueue.length - 1]?.type === TokenType.Resize) {
        continue
      }
      tokenQueue.push(token)
    }
    if (pendingWaiter !== undefined) {
      const token = tokenQueue.shift()
      if (token !== undefined) {
        const waiter = pendingWaiter
        pendingWaiter = undefined
        waiter(token)
      }
    }
  }

  const onData = (data: Buffer): void => {
    const text = decoder.write(data)
    if (text !== '') {
      deliver(parser.feed(text))
    }
  }

  const onResize = (): void => {
    deliver(freeze([freeze({ type: TokenType.Resize })]))
  }

  const openSession = (): void => {
    if (sessionActive) return
    sessionActive = true
    savedRawMode = input.isRaw === true
    if (input.setRawMode) {
      input.setRawMode(true)
      write(Ansi.BracketedPasteOn)
    }
    input.on('data', onData)
    output.on('resize', onResize)
    input.resume()
  }

  const closeSession = (): void => {
    if (!sessionActive) return
    sessionActive = false
    input.removeListener('data', onData)
    output.removeListener('resize', onResize)
    if (input.setRawMode) {
      write(Ansi.BracketedPasteOff)
      input.setRawMode(savedRawMode)
    }
    input.pause()
  }

  const readToken = (): Promise<InputToken> => {
    openSession()
    const queued = tokenQueue.shift()
    if (queued !== undefined) {
      return promiseResolve(queued)
    }
    return createPromise((resolve) => {
      pendingWaiter = resolve
    })
  }

  const readKey = async (): Promise<string> => {
    let token = await readToken()
    while (token.type === TokenType.Resize) {
      token = await readToken()
    }
    return token.value
  }

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

  const getSize = (): TerminalSize =>
    freeze({
      columns: output.columns > 0 ? output.columns : 80,
      rows: output.rows > 0 ? output.rows : 24,
    })

  const close = (): void => {
    if (closed) return
    closed = true
    closeSession()
    if (rl) {
      rl.close()
      rl = undefined
    }
    write(Ansi.ShowCursor)
  }

  return freeze({
    write,
    readKey,
    readToken,
    readLine,
    clearLines,
    getSize,
    close,
    isCancelled: () => cancelled,
    cancel: () => {
      cancelled = true
    },
  })
}
