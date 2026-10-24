import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import type { TextConfig } from '../types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { text } from './text'

describe('text', () => {
  let input: TtyInput
  let output: CapturedOutput

  beforeEach(() => {
    input = createTtyInput()
    output = createCapturedOutput({ tty: true })
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

      await input.sendKeys('h', 'e', 'l', 'l', 'o', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'hello' })
    })

    it('returns empty string when submitted with no input', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: '' })
    })

    it('returns initial value when submitted with no input', async () => {
      const config = createConfig({ initial: 'default' })
      const promise = text(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'default' })
    })

    it('submits text and Enter delivered in one chunk', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('billing\r')

      expect(await promise).toEqual({ result: PromptResult.Submitted, value: 'billing' })
    })

    it('submits a line ending in a line feed, the shape a pipe sends', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('billing\n')

      expect(await promise).toEqual({ result: PromptResult.Submitted, value: 'billing' })
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys(Key.CtrlC)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Cancelled, value: undefined })
    })

    it('returns cancelled result after partial input', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'b', 'c', Key.CtrlC)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Cancelled, value: undefined })
    })

    it('returns cancelled result when the input ends', async () => {
      const config = createConfig()
      const promise = text(config)

      input.end()

      expect(await promise).toEqual({ result: PromptResult.Cancelled, value: undefined })
    })
  })

  describe('editing', () => {
    it('handles backspace to delete characters', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'b', 'c', Key.Backspace, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'ab' })
    })

    it('handles alternate backspace character', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('x', 'y', '\b', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'x' })
    })

    it('ignores backspace at start', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys(Key.Backspace, Key.Backspace, 'a', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'a' })
    })

    it('handles left arrow movement', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'c', Key.Left, 'b', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'abc' })
    })

    it('handles right arrow movement', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'c', Key.Left, Key.Left, Key.Right, 'b', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'abc' })
    })

    it('ignores left arrow at start', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys(Key.Left, Key.Left, 'a', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'a' })
    })

    it('ignores right arrow at end', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', Key.Right, Key.Right, 'b', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'ab' })
    })
  })

  describe('validation', () => {
    it('rejects invalid input until the value passes validation', async () => {
      const config = createConfig({
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      // why: first submit fails validation, second succeeds
      await input.sendKeys('a', Key.Enter, 'b', 'c', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'abc' })
    })

    it('shows the validation error for rejected input', async () => {
      const config = createConfig({
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      // why: first submit fails validation, second succeeds
      await input.sendKeys('a', Key.Enter, 'b', 'c', Key.Enter)
      await promise

      expect(output.text()).toContain('Too short')
    })

    it('accepts valid input immediately', async () => {
      const config = createConfig({
        validate: (value) => (value.includes('@') ? undefined : 'Must be email'),
      })
      const promise = text(config)

      await input.sendKeys('a', '@', 'b', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'a@b' })
    })

    it('validates initial value', async () => {
      const config = createConfig({
        initial: 'ab',
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      // why: submit initial which is too short, then add character
      await input.sendKeys(Key.Enter, 'c', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'abc' })
    })
  })

  describe('cursor positioning', () => {
    it('parks the caret at its column when it sits mid-value', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'b', 'c', Key.Left, Key.Left, Key.Enter)
      await promise

      // why: the '? Enter value: ' prefix spans 15 columns; caret at value index 1 parks at column 16
      expect(output.text()).toContain('\x1B[16C')
    })

    it('shows the initial-value hint when the value is cleared', async () => {
      const config = createConfig({ initial: 'abc' })
      const promise = text(config)

      await input.sendKeys(Key.Backspace, Key.Backspace, Key.Backspace, Key.Enter)
      await promise

      // why: the cleared frame paints the dim hint, then parks the caret at column 15, the end of the prefix, right before it
      expect(output.text()).toContain('\x1B[2mabc\x1B[0m\r\x1B[15C')
    })
  })

  describe('paste', () => {
    it('inserts a multi-character chunk as pasted text', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('hello world', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'hello world' })
    })

    it('inserts bracketed paste content accumulated across chunks', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('\x1B[200~pasted ', 'text\x1B[201~', Key.Enter)

      const result = await promise

      expect(result.value).toBe('pasted text')
    })

    it('collapses newline runs in pasted text into single spaces', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('\x1B[200~line1\r\nline2\nline3\x1B[201~', Key.Enter)

      const result = await promise

      expect(result.value).toBe('line1 line2 line3')
    })

    it('never submits from a paste containing a newline', async () => {
      const config = createConfig()
      const promise = text(config)

      // why: the embedded carriage return must not act as Enter; only the explicit Enter afterwards submits
      await input.sendKeys('first\rsecond', Key.Enter)

      const result = await promise

      expect(result.value).toBe('first second')
    })

    it('strips control characters from pasted text', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('\x1B[200~ab\x07cd\x1B[201~', Key.Enter)

      const result = await promise

      expect(result.value).toBe('abcd')
    })

    it('inserts pasted text at the cursor position', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'b', Key.Left, '\x1B[200~XY\x1B[201~', Key.Enter)

      const result = await promise

      expect(result.value).toBe('aXYb')
    })

    it('ignores a paste that sanitizes to nothing', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('\x1B[200~\x07\x1B[201~', 'z', Key.Enter)

      const result = await promise

      expect(result.value).toBe('z')
    })
  })

  describe('resize', () => {
    it('repaints the current value when the terminal resizes', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'b')
      await flushPromises()

      const before = output.text().length
      output.resize(40)
      await flushPromises()
      const repaint = output.text().slice(before)

      await input.sendKeys(Key.Enter)
      await promise

      // why: the repaint after resize re-renders the preserved value
      expect(repaint).toContain('ab')
    })

    it('submits the value typed before the terminal resized', async () => {
      const config = createConfig()
      const promise = text(config)

      await input.sendKeys('a', 'b')
      await flushPromises()

      output.resize(40)
      await flushPromises()

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result.value).toBe('ab')
    })

    it('preserves a validation error across a resize', async () => {
      const config = createConfig({
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      await input.sendKeys('a', Key.Enter)
      await flushPromises()

      const before = output.text().length
      output.emit('resize')
      await flushPromises()
      const repaint = output.text().slice(before)

      await input.sendKeys('b', 'c', Key.Enter)
      await promise

      expect(repaint).toContain('Too short')
    })

    it('submits a corrected value after a resize repainted the validation error', async () => {
      const config = createConfig({
        validate: (value) => (value.length < 3 ? 'Too short' : undefined),
      })
      const promise = text(config)

      await input.sendKeys('a', Key.Enter)
      await flushPromises()

      output.emit('resize')
      await flushPromises()

      await input.sendKeys('b', 'c', Key.Enter)

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

      await input.sendKeys('a', 'b', 'c', Key.Enter)
      await promise

      // why: initial render plus one per keystroke
      expect(snapshots).toEqual(['', 'a', 'ab', 'abc', 'abc'])
    })

    it('renders the message computed from the current value', async () => {
      const config = createConfig({
        renderMessage: (value) => `Length: ${value.length}`,
      })
      const promise = text(config)

      await input.sendKeys('a', 'b', 'c', Key.Enter)
      await promise

      expect(output.text()).toContain('Length: 3')
    })

    it('falls back to static message when renderMessage is absent', async () => {
      const config = createConfig({ message: 'Static:' })
      const promise = text(config)

      await input.sendKeys(Key.Enter)
      await promise

      expect(output.text()).toContain('Static:')
    })
  })

  describe('format', () => {
    it('submits the raw value while a format function masks the display', async () => {
      const config = createConfig({
        format: (value) => '*'.repeat(value.length),
      })
      const promise = text(config)

      await input.sendKeys('s', 'e', 'c', 'r', 'e', 't', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'secret' })
    })

    it('applies format function for display', async () => {
      const config = createConfig({
        format: (value) => '*'.repeat(value.length),
      })
      const promise = text(config)

      await input.sendKeys('s', 'e', 'c', 'r', 'e', 't', Key.Enter)
      await promise

      // why: output should show masked value
      expect(output.text()).toContain('******')
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Test message:' })
      const promise = text(config)

      await input.sendKeys(Key.Enter)
      await promise

      expect(output.text()).toContain('Test message:')
    })

    it('shows initial value hint', async () => {
      const config = createConfig({ initial: 'default value' })
      const promise = text(config)

      await input.sendKeys(Key.Enter)
      await promise

      // why: initial should be shown somewhere in output
      expect(output.text()).toContain('default value')
    })

    it('shows submitted initial value when no user input', async () => {
      const config = createConfig({ initial: 'default' })
      const promise = text(config)

      await input.sendKeys(Key.Enter)
      await promise

      // why: submitted display shows initial value
      expect(output.text()).toContain('default')
    })

    it('shows formatted value on submission with format', async () => {
      const config = createConfig({
        format: (v) => `[${v}]`,
        initial: 'xyz',
      })
      const promise = text(config)

      await input.sendKeys(Key.Enter)
      await promise

      // why: formatted value should appear
      expect(output.text()).toContain('[xyz]')
    })
  })
})
