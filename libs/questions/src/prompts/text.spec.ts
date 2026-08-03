import type { TextConfig } from '../types'
import { PassThrough } from 'node:stream'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { text } from './text'

/**
 * Creates a mock input stream for testing.
 *
 * @returns Mock input stream with raw mode support and enqueue methods
 */
function createMockInput(): PassThrough & {
  isRaw: boolean
  setRawMode: (mode: boolean) => void
  enqueueKeys: (keys: string[]) => void
} {
  const input = new PassThrough() as PassThrough & {
    isRaw: boolean
    setRawMode: (mode: boolean) => void
    enqueueKeys: (keys: string[]) => void
  }
  input.isRaw = false
  input.setRawMode = (mode: boolean): void => {
    input.isRaw = mode
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

  input.enqueueKeys = (keys: string[]): void => {
    keyQueue.push(...keys)
    emitNext()
  }

  return input
}

/**
 * Creates a mock output stream for testing.
 *
 * @returns Mock output stream that collects written data
 */
function createMockOutput(): PassThrough & { getWrittenData: () => string; columns?: number; rows?: number } {
  const output = new PassThrough() as PassThrough & { getWrittenData: () => string; columns?: number; rows?: number }
  let writtenData = ''

  const originalWrite = output.write.bind(output)
  output.write = ((chunk: string | Buffer): boolean => {
    writtenData += chunk.toString()
    return originalWrite(chunk)
  }) as typeof output.write

  output.getWrittenData = (): string => writtenData

  return output
}

describe('text', () => {
  let input: ReturnType<typeof createMockInput>
  let output: ReturnType<typeof createMockOutput>

  beforeEach(() => {
    input = createMockInput()
    output = createMockOutput()
  })

  afterEach(() => {
    input.destroy()
    output.destroy()
  })

  const createConfig = (overrides: Partial<TextConfig> = {}): TextConfig => ({
    message: 'Enter value:',
    input: input as unknown as NodeJS.ReadStream,
    output: output as unknown as NodeJS.WriteStream,
    ...overrides,
  })

  describe('submission', () => {
    it('returns submitted result with typed value', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['h', 'e', 'l', 'l', 'o', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('hello')
    })

    it('returns empty string when submitted with no input', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('')
    })

    it('returns initial value when submitted with no input', async () => {
      const config = createConfig({ initial: 'default' })
      const promise = text(config)

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('default')
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys([Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
      expect(result.value).toBeUndefined()
    })

    it('returns cancelled result after partial input', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', 'b', 'c', Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
      expect(result.value).toBeUndefined()
    })
  })

  describe('editing', () => {
    it('handles backspace to delete characters', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', 'b', 'c', Key.Backspace, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('ab')
    })

    it('handles alternate backspace character', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['x', 'y', '\b', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('x')
    })

    it('ignores backspace at start', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys([Key.Backspace, Key.Backspace, 'a', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('a')
    })

    it('handles left arrow movement', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', 'c', Key.Left, 'b', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('abc')
    })

    it('handles right arrow movement', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', 'c', Key.Left, Key.Left, Key.Right, 'b', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('abc')
    })

    it('ignores left arrow at start', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys([Key.Left, Key.Left, 'a', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('a')
    })

    it('ignores right arrow at end', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', Key.Right, Key.Right, 'b', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('ab')
    })
  })

  describe('validation', () => {
    it('rejects invalid input and shows error', async () => {
      const config = createConfig({
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      // why: first submit fails validation, second succeeds
      input.enqueueKeys(['a', Key.Enter, 'b', 'c', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('abc')

      // why: error should have been displayed
      const data = output.getWrittenData()

      expect(data).toContain('Too short')
    })

    it('accepts valid input immediately', async () => {
      const config = createConfig({
        validate: (value) => (value.includes('@') ? undefined : 'Must be email'),
      })
      const promise = text(config)

      input.enqueueKeys(['a', '@', 'b', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('a@b')
    })

    it('validates initial value', async () => {
      const config = createConfig({
        initial: 'ab',
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      // why: submit initial which is too short, then add character
      input.enqueueKeys([Key.Enter, 'c', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('abc')
    })
  })

  describe('cursor positioning', () => {
    it('parks the caret at its column when it sits mid-value', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', 'b', 'c', Key.Left, Key.Left, Key.Enter])
      await promise

      // why: the '? Enter value: ' prefix spans 15 columns; caret at value index 1 parks at column 16
      expect(output.getWrittenData()).toContain('\x1B[16C')
    })

    it('shows the initial-value hint when the value is cleared', async () => {
      const config = createConfig({ initial: 'abc' })
      const promise = text(config)

      input.enqueueKeys([Key.Backspace, Key.Backspace, Key.Backspace, Key.Enter])
      await promise

      // why: clearing the value repaints the dim hint and parks the caret before it
      const data = output.getWrittenData()

      expect(data).toContain('\x1B[2m') // why: dim ANSI for the hint
      expect(data).toContain('\x1B[15C') // why: caret parked at the end of the 15-column prefix
    })
  })

  describe('paste', () => {
    it('inserts a multi-character chunk as pasted text', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['hello world', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('hello world')
    })

    it('inserts bracketed paste content accumulated across chunks', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['\x1B[200~pasted ', 'text\x1B[201~', Key.Enter])

      const result = await promise

      expect(result.value).toBe('pasted text')
    })

    it('collapses newline runs in pasted text into single spaces', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['\x1B[200~line1\r\nline2\nline3\x1B[201~', Key.Enter])

      const result = await promise

      expect(result.value).toBe('line1 line2 line3')
    })

    it('never submits from a paste containing a newline', async () => {
      const config = createConfig()
      const promise = text(config)

      // why: the embedded carriage return must not act as Enter; only the explicit Enter afterwards submits
      input.enqueueKeys(['first\rsecond', Key.Enter])

      const result = await promise

      expect(result.value).toBe('first second')
    })

    it('strips control characters from pasted text', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['\x1B[200~ab\x07cd\x1B[201~', Key.Enter])

      const result = await promise

      expect(result.value).toBe('abcd')
    })

    it('inserts pasted text at the cursor position', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', 'b', Key.Left, '\x1B[200~XY\x1B[201~', Key.Enter])

      const result = await promise

      expect(result.value).toBe('aXYb')
    })

    it('ignores a paste that sanitizes to nothing', async () => {
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['\x1B[200~\x07\x1B[201~', 'z', Key.Enter])

      const result = await promise

      expect(result.value).toBe('z')
    })
  })

  describe('resize', () => {
    it('repaints the current value when the terminal resizes', async () => {
      output.columns = 80
      const config = createConfig()
      const promise = text(config)

      input.enqueueKeys(['a', 'b'])
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))

      const before = output.getWrittenData().length
      output.columns = 40
      output.emit('resize')
      await new Promise((resolve) => setImmediate(resolve))

      // why: the repaint after resize re-renders the preserved value
      expect(output.getWrittenData().slice(before)).toContain('ab')

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.value).toBe('ab')
    })

    it('preserves a validation error across a resize', async () => {
      const config = createConfig({
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      input.enqueueKeys(['a', Key.Enter])
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))

      const before = output.getWrittenData().length
      output.emit('resize')
      await new Promise((resolve) => setImmediate(resolve))

      expect(output.getWrittenData().slice(before)).toContain('Too short')

      input.enqueueKeys(['b', 'c', Key.Enter])

      const result = await promise

      expect(result.value).toBe('abc')
    })
  })

  describe('renderMessage', () => {
    it('recomputes the message on every keystroke using current value', async () => {
      const snapshots: string[] = []
      const config = createConfig({
        renderMessage: (value) => {
          snapshots.push(value)
          return `Length: ${value.length}`
        },
      })
      const promise = text(config)

      input.enqueueKeys(['a', 'b', 'c', Key.Enter])
      await promise

      // why: initial render plus one per keystroke
      expect(snapshots).toEqual(['', 'a', 'ab', 'abc', 'abc'])

      const data = output.getWrittenData()

      expect(data).toContain('Length: 3')
    })

    it('falls back to static message when renderMessage is absent', async () => {
      const config = createConfig({ message: 'Static:' })
      const promise = text(config)

      input.enqueueKeys([Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('Static:')
    })
  })

  describe('format', () => {
    it('applies format function for display', async () => {
      const config = createConfig({
        format: (value) => '*'.repeat(value.length),
      })
      const promise = text(config)

      input.enqueueKeys(['s', 'e', 'c', 'r', 'e', 't', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('secret')

      // why: output should show masked value
      const data = output.getWrittenData()

      expect(data).toContain('******')
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Test message:' })
      const promise = text(config)

      input.enqueueKeys([Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('Test message:')
    })

    it('shows initial value hint', async () => {
      const config = createConfig({ initial: 'default value' })
      const promise = text(config)

      input.enqueueKeys([Key.Enter])
      await promise

      // why: initial should be shown somewhere in output
      expect(output.getWrittenData()).toContain('default value')
    })

    it('shows submitted initial value when no user input', async () => {
      const config = createConfig({ initial: 'default' })
      const promise = text(config)

      input.enqueueKeys([Key.Enter])
      await promise

      // why: submitted display shows initial value
      expect(output.getWrittenData()).toContain('default')
    })

    it('shows formatted value on submission with format', async () => {
      const config = createConfig({
        format: (v) => `[${v}]`,
        initial: 'xyz',
      })
      const promise = text(config)

      input.enqueueKeys([Key.Enter])
      await promise

      // why: formatted value should appear
      expect(output.getWrittenData()).toContain('[xyz]')
    })
  })
})
