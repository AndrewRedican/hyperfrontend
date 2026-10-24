import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import type { ConfirmConfig } from '../types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { confirm } from './confirm'

describe('confirm', () => {
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

  const createConfig = (overrides: Partial<ConfirmConfig> = {}): ConfirmConfig => ({
    message: 'Continue?',
    input: input as unknown as NodeJS.ReadStream,
    output: output as unknown as NodeJS.WriteStream,
    ...overrides,
  })

  describe('yes response', () => {
    it('returns true for lowercase y', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('y')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: true })
    })

    it('returns true for uppercase Y', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('Y')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: true })
    })
  })

  describe('no response', () => {
    it('returns false for lowercase n', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('n')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: false })
    })

    it('returns false for uppercase N', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('N')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: false })
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys(Key.CtrlC)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Cancelled, value: undefined })
    })
  })

  describe('default value', () => {
    it('returns initial true on Enter', async () => {
      const config = createConfig({ initial: true })
      const promise = confirm(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: true })
    })

    it('returns initial false on Enter', async () => {
      const config = createConfig({ initial: false })
      const promise = confirm(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: false })
    })

    it('ignores Enter when no initial provided', async () => {
      const config = createConfig({ initial: undefined })
      const promise = confirm(config)

      // why: Enter is ignored, then y is pressed
      await input.sendKeys(Key.Enter, 'y')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: true })
    })
  })

  describe('invalid keys', () => {
    it('ignores invalid keys and waits for valid input', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('x', 'z', '1', 'y')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: true })
    })

    it('ignores arrow keys', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys(Key.Up, Key.Down, Key.Left, Key.Right, 'n')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: false })
    })
  })

  describe('paste', () => {
    it('accepts a pasted yes', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('\x1B[200~yes\n\x1B[201~')

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: true })
    })

    it('accepts a pasted no with surrounding whitespace', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('\x1B[200~ NO \x1B[201~')

      const result = await promise

      expect(result.value).toBe(false)
    })

    it('accepts a non-bracketed pasted answer', async () => {
      const config = createConfig()
      const promise = confirm(config)

      // why: a multi-character chunk is a paste from a non-bracketed-paste terminal
      await input.sendKeys('yes')

      const result = await promise

      expect(result.value).toBe(true)
    })

    it('ignores pasted text that is not an answer', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('\x1B[200~maybe\x1B[201~', 'y')

      const result = await promise

      expect(result.value).toBe(true)
    })
  })

  describe('resize', () => {
    it('repaints the prompt when the terminal resizes', async () => {
      const config = createConfig({ message: 'Proceed?' })
      const promise = confirm(config)

      await flushPromises()
      const before = output.text().length
      output.emit('resize')
      await flushPromises()
      const repaint = output.text().slice(before)

      await input.sendKeys('y')
      await promise

      expect(repaint).toContain('Proceed?')
    })

    it('still accepts an answer after the terminal resizes', async () => {
      const config = createConfig({ message: 'Proceed?' })
      const promise = confirm(config)

      await flushPromises()
      output.emit('resize')
      await flushPromises()

      await input.sendKeys('y')

      const result = await promise

      expect(result.value).toBe(true)
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Proceed?' })
      const promise = confirm(config)

      await input.sendKeys('y')
      await promise

      expect(output.text()).toContain('Proceed?')
    })

    it('shows Y/n when initial is true', async () => {
      const config = createConfig({ initial: true })
      const promise = confirm(config)

      await input.sendKeys('y')
      await promise

      expect(output.text()).toContain('Y/n')
    })

    it('shows y/N when initial is false', async () => {
      const config = createConfig({ initial: false })
      const promise = confirm(config)

      await input.sendKeys('n')
      await promise

      expect(output.text()).toContain('y/N')
    })

    it('shows y/n when no initial provided', async () => {
      const config = createConfig({ initial: undefined })
      const promise = confirm(config)

      await input.sendKeys('y')
      await promise

      expect(output.text()).toContain('y/n')
    })

    it('shows Yes when confirmed', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('y')
      await promise

      expect(output.text()).toContain('Yes')
    })

    it('shows No when declined', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys('n')
      await promise

      expect(output.text()).toContain('No')
    })

    it('shows cancelled when cancelled', async () => {
      const config = createConfig()
      const promise = confirm(config)

      await input.sendKeys(Key.CtrlC)
      await promise

      expect(output.text()).toContain('cancelled')
    })
  })
})
