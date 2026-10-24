import type { Readable } from 'node:stream'
import { PassThrough, Writable } from 'node:stream'
import { realTimers } from '../async/real-timers'
import { PASTE } from './keys'

/**
 * A readable stream standing in for a terminal's stdin, which a test types into.
 */
export interface TtyInput extends PassThrough {
  /** Always true, so code that checks for a terminal treats the stream as one. */
  isTTY: true
  /** Whether raw mode is on, as last set through `setRawMode`. */
  isRaw: boolean
  /** Records the raw-mode flag, as a terminal's stdin would apply it. */
  setRawMode(mode: boolean): TtyInput
  /** Sends key sequences one at a time, each on its own turn of the event loop, resolving after the last. */
  sendKeys(...keys: string[]): Promise<void>
  /** Sends text as one bracketed paste, resolving once it has been sent. */
  paste(text: string): Promise<void>
}

/**
 * How a captured output stream presents itself.
 */
export type CapturedOutputOptions = {
  /** Whether the stream reports itself as a terminal. Defaults to false. */
  tty?: boolean
  /** Terminal width when `tty` is set. Defaults to 80. */
  columns?: number
  /** Terminal height when `tty` is set. Defaults to 24. */
  rows?: number
  /** Colour depth in bits when `tty` is set. Defaults to 1, so colour-aware code writes plain text. */
  colorDepth?: number
}

/**
 * A writable stream that keeps everything written to it, standing in for stdout or stderr.
 */
export interface CapturedOutput extends Writable {
  /** Whether the stream reports itself as a terminal. */
  isTTY: boolean
  /** Terminal width, or undefined when not a terminal. */
  columns: number | undefined
  /** Terminal height, or undefined when not a terminal. */
  rows: number | undefined
  /** Everything written so far, decoded as UTF-8. */
  text(): string
  /** Forgets what has been written so far. */
  clear(): void
  /** Changes the terminal size and emits `resize`, as a terminal does when its window changes. */
  resize(columns: number, rows?: number): void
  /** Reports the colour depth, as a terminal's `WriteStream` does. */
  getColorDepth(): number
  /** Reports whether at least `count` colours are available, as a terminal's `WriteStream` does. */
  hasColors(count?: number): boolean
}

/**
 * Decodes a written or read chunk to text.
 *
 * @param chunk - A string or bytes.
 * @returns The chunk as UTF-8 text.
 */
function decode(chunk: unknown): string {
  return typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8')
}

/**
 * Creates a stand-in for a terminal's stdin that a test types into.
 *
 * Keys are written into the stream one per turn of the event loop, so a prompt's read loop
 * handles each key, and re-renders, before the next arrives. Keys sent before anything
 * listens are buffered rather than lost. Calls queue behind one another, so two `sendKeys`
 * calls without an `await` between them still arrive in order.
 *
 * @returns The input stream.
 * @example Answering a text prompt
 * ```ts
 * const input = createTtyInput()
 * const output = createCapturedOutput({ tty: true })
 * const answer = text({ message: 'Name?', input, output })
 * await input.sendKeys('a', 'd', 'a', Keys.Enter)
 * expect(await answer).toBe('ada')
 * ```
 */
export function createTtyInput(): TtyInput {
  const input = new PassThrough() as TtyInput
  let queue = Promise.resolve()
  input.isTTY = true
  input.isRaw = false
  input.setRawMode = (mode) => {
    input.isRaw = mode
    return input
  }
  input.sendKeys = (...keys) => {
    queue = queue.then(async () => {
      for (const key of keys) {
        await new Promise((resolve) => realTimers.setImmediate(resolve))
        input.write(key)
      }
    })
    return queue
  }
  input.paste = (text) => input.sendKeys(`${PASTE.start}${text}${PASTE.end}`)
  return input
}

/**
 * Creates a stand-in for stdout or stderr that keeps everything written to it.
 *
 * Writes complete synchronously, so `text()` reflects a write as soon as it returns. As a
 * terminal, the stream reports a size and a colour depth, and `resize` emits the event a
 * terminal emits when its window changes.
 *
 * @param options - Whether it is a terminal, and its size and colour depth.
 * @returns The output stream.
 * @example Reading what a command printed
 * ```ts
 * const stderr = createCapturedOutput()
 * const code = await runCli({ argv: ['--bad'], stderr })
 * expect({ code, message: stderr.text() }).toEqual({ code: 1, message: 'unknown option --bad\n' })
 * ```
 */
export function createCapturedOutput(options: CapturedOutputOptions = {}): CapturedOutput {
  let written = ''
  const output = new Writable({
    decodeStrings: false,
    write(chunk, _encoding, callback) {
      written += decode(chunk)
      callback()
    },
  }) as CapturedOutput
  const depth = options.colorDepth ?? 1
  output.isTTY = options.tty ?? false
  output.columns = output.isTTY ? (options.columns ?? 80) : undefined
  output.rows = output.isTTY ? (options.rows ?? 24) : undefined
  output.text = () => written
  output.clear = () => {
    written = ''
  }
  output.resize = (columns, rows) => {
    output.columns = columns
    output.rows = rows ?? output.rows
    output.emit('resize')
  }
  output.getColorDepth = () => depth
  output.hasColors = (count = 16) => 2 ** depth >= count
  return output
}

/**
 * Reads everything a readable stream has buffered right now, without waiting for more.
 *
 * @param stream - A stream holding data nothing has consumed, such as a `PassThrough` handed to code that wrote to it.
 * @returns The buffered data decoded as UTF-8, or an empty string when nothing is buffered.
 * @example Reading what a command wrote to a plain stream
 * ```ts
 * const stdout = new PassThrough()
 * printSummary(stdout)
 * expect(readAll(stdout)).toBe('3 packages\n')
 * ```
 */
export function readAll(stream: Readable): string {
  let text = ''
  for (let chunk: unknown = stream.read(); chunk !== null; chunk = stream.read()) text += decode(chunk)
  return text
}
