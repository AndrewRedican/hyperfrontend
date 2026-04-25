import { PassThrough } from 'node:stream'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Key-code constants mirroring `@hyperfrontend/questions`'s internal `Key` export. */
export const TestKey = freeze(<const>{
  /** Enter / carriage return */
  Enter: '\r',
  /** Ctrl-C — drives the prompt's cancellation path */
  CtrlC: '\x03',
  /** Deletes the character before the cursor */
  Backspace: '\x7F',
  /** Up arrow */
  Up: '\x1B[A',
  /** Down arrow */
  Down: '\x1B[B',
  /** Single literal space character */
  Space: ' ',
  /** Horizontal tab — triggers completion / focus movement in prompts */
  Tab: '\t',
})

/** Mock readable stream with a raw-mode flag and a key enqueue helper. */
export type MockInput = NodeJS.ReadStream & {
  /** Enqueues key strokes to be emitted on the `data` event asynchronously */
  enqueueKeys: (keys: readonly string[]) => void
}

/** Mock writable stream that captures written output for assertions. */
export type MockOutput = NodeJS.WriteStream & {
  /** Returns everything written so far as a single string */
  getWrittenData: () => string
}

/** Paired mock streams usable as `input`/`output` for any lib-questions prompt. */
export interface MockTerminal {
  /** Mock readable — pass as `config.input` */
  input: MockInput
  /** Mock writable — pass as `config.output` */
  output: MockOutput
  /** Releases both streams */
  destroy: () => void
}

/**
 * Creates a lightweight mock terminal suitable for driving lib-questions
 * prompts in unit tests. Key strokes enqueued via `input.enqueueKeys` are
 * emitted asynchronously one at a time so the prompt's async read loop sees
 * them in order.
 *
 * @returns Mock terminal with readable/writable pair and a `destroy` helper
 *
 * @example Driving a text prompt in a test
 * ```typescript
 * const term = createMockTerminal()
 * const pending = text({ message: 'Name:', input: term.input, output: term.output })
 * term.input.enqueueKeys(['h', 'i', Key.Enter])
 * await pending
 * ```
 */
export function createMockTerminal(): MockTerminal {
  const input = createMockInput()
  const output = createMockOutput()

  return {
    input,
    output,
    destroy: (): void => {
      input.destroy()
      output.destroy()
    },
  }
}

/**
 * Builds the mock readable stream.
 *
 * @returns Readable stream augmented with raw-mode flag and `enqueueKeys`
 */
function createMockInput(): MockInput {
  const input = <MockInput>(<unknown>new PassThrough())
  input.isRaw = false
  input.setRawMode = (mode: boolean): MockInput => {
    input.isRaw = mode
    return input
  }

  const keyQueue: string[] = []
  let emitting = false

  const emitNext = (): void => {
    if (keyQueue.length > 0 && !emitting) {
      emitting = true
      const key = keyQueue.shift()
      if (key !== undefined) {
        setImmediate(() => {
          input.emit('data', Buffer.from(key))
          emitting = false
          emitNext()
        })
      }
    }
  }

  input.enqueueKeys = (keys: readonly string[]): void => {
    keyQueue.push(...keys)
    emitNext()
  }

  return input
}

/**
 * Builds the mock writable stream.
 *
 * @returns Writable stream augmented with `getWrittenData`
 */
function createMockOutput(): MockOutput {
  const output = <MockOutput>(<unknown>new PassThrough())
  let writtenData = ''

  const originalWrite = output.write.bind(output)
  output.write = <typeof output.write>((chunk: string | Buffer): boolean => {
    writtenData += chunk.toString()
    return originalWrite(chunk)
  })

  output.getWrittenData = (): string => writtenData

  return output
}
