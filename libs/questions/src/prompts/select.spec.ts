import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import type { SelectConfig, Choice } from '../types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { stripAnsi } from '../ansi-text'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { select } from './select'

const basicChoices: ReadonlyArray<Choice<string>> = [
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
]

describe('select', () => {
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

  const createConfig = <T = string>(overrides: Partial<SelectConfig<T>> = {}): SelectConfig<T> =>
    ({
      message: 'Select a color:',
      choices: basicChoices,
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream,
      ...overrides,
    }) as SelectConfig<T>

  describe('selection', () => {
    it('selects first item by default and submits on Enter', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'red' })
    })

    it('selects second item with Down+Enter', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'green' })
    })

    it('selects third item with Down+Down+Enter', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.Down, Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'blue' })
    })

    it('uses initial selection', async () => {
      const config = createConfig({ initial: 2 })
      const promise = select(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'blue' })
    })
  })

  describe('navigation', () => {
    it('moves up with Up key', async () => {
      const config = createConfig({ initial: 2 })
      const promise = select(config)

      await input.sendKeys(Key.Up, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'green' })
    })

    it('stops at top when pressing Up', async () => {
      const config = createConfig({ initial: 0 })
      const promise = select(config)

      await input.sendKeys(Key.Up, Key.Up, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'red' })
    })

    it('stops at bottom when pressing Down', async () => {
      const config = createConfig({ initial: 2 })
      const promise = select(config)

      await input.sendKeys(Key.Down, Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'blue' })
    })
  })

  describe('disabled choices', () => {
    it('skips disabled choices when navigating down', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'One', value: '1' },
        { label: 'Two', value: '2', disabled: true },
        { label: 'Three', value: '3' },
      ]
      const config = createConfig({ choices })
      const promise = select(config)

      await input.sendKeys(Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: '3' })
    })

    it('skips disabled choices when navigating up', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'One', value: '1' },
        { label: 'Two', value: '2', disabled: true },
        { label: 'Three', value: '3' },
      ]
      const config = createConfig({ choices, initial: 2 })
      const promise = select(config)

      await input.sendKeys(Key.Up, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: '1' })
    })

    it('prevents selection of disabled choice on Enter', async () => {
      const choices: ReadonlyArray<Choice<string>> = [{ label: 'Disabled', value: 'x', disabled: true }]
      const config = createConfig({ choices })
      const promise = select(config)

      // why: Enter is ignored for disabled, then cancel
      await input.sendKeys(Key.Enter, Key.CtrlC)

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.CtrlC)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Cancelled, value: undefined })
    })

    it('returns cancelled after navigation', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.Down, Key.Down, Key.CtrlC)

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })
  })

  describe('scrolling', () => {
    const manyChoices: ReadonlyArray<Choice<string>> = Array.from({ length: 15 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `opt${i + 1}`,
    }))

    it('scrolls down when navigating beyond visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5 })
      const promise = select(config)

      // why: navigate down past visible area
      const keys: Key[] = Array.from({ length: 7 }, () => Key.Down)
      keys.push(Key.Enter)
      await input.sendKeys(...keys)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'opt8' })
    })

    it('scrolls up when navigating above visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 10 })
      const promise = select(config)

      await input.sendKeys(Key.Up, Key.Up, Key.Up, Key.Up, Key.Up, Key.Up, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'opt5' })
    })

    it('shows scroll indicators', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 7 })
      const promise = select(config)

      await input.sendKeys(Key.Enter)
      await promise

      const data = output.text()

      // why: the middle of the list renders the above indicator before the below indicator in one frame
      expect(data).toMatch(/more above[\s\S]*more below/)
    })
  })

  describe('configuration', () => {
    it('rejects an empty choice list', async () => {
      await expect(select(createConfig({ choices: [] }))).rejects.toThrow('select requires at least one choice')
    })

    it('rejects an initial index past the last choice', async () => {
      await expect(select(createConfig({ initial: 7 }))).rejects.toThrow('select initial must be an index between 0 and 2, received 7')
    })

    it('rejects a negative initial index', async () => {
      await expect(select(createConfig({ initial: -1 }))).rejects.toThrow('select initial must be an index between 0 and 2, received -1')
    })

    it('rejects an initial index that is not a whole number', async () => {
      await expect(select(createConfig({ initial: 1.5 }))).rejects.toThrow('select initial must be an index between 0 and 2, received 1.5')
    })
  })

  describe('hints', () => {
    it('displays hint text', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'Basic', value: 'basic', hint: 'Free tier' },
        { label: 'Pro', value: 'pro', hint: '$10/month' },
      ]
      const config = createConfig({ choices })
      const promise = select(config)

      await input.sendKeys(Key.Enter)
      await promise

      const data = output.text()

      expect(data).toContain('Free tier')
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Pick one:' })
      const promise = select(config)

      await input.sendKeys(Key.Enter)
      await promise

      expect(output.text()).toContain('Pick one:')
    })

    it('shows selected value on submission', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.Down, Key.Enter)
      await promise

      expect(output.text()).toContain('Green')
    })

    it('shows cancelled text on cancellation', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.CtrlC)
      await promise

      expect(output.text()).toContain('cancelled')
    })
  })

  describe('typed values', () => {
    it('works with number values', async () => {
      const choices: ReadonlyArray<Choice<number>> = [
        { label: 'One', value: 1 },
        { label: 'Two', value: 2 },
      ]
      const config = createConfig<number>({ choices })
      const promise = select(config)

      await input.sendKeys(Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 2 })
    })

    it('works with object values', async () => {
      interface Option {
        readonly id: number
        readonly name: string
      }
      const choices: ReadonlyArray<Choice<Option>> = [
        { label: 'Option A', value: { id: 1, name: 'a' } },
        { label: 'Option B', value: { id: 2, name: 'b' } },
      ]
      const config = createConfig<Option>({ choices })
      const promise = select(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: { id: 1, name: 'a' } })
    })
  })

  describe('additional coverage', () => {
    const manyChoices: ReadonlyArray<Choice<string>> = Array.from({ length: 15 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `opt${i + 1}`,
    }))

    it('skips multiple consecutive disabled items when navigating down', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'First', value: '1' },
        { label: 'Disabled 1', value: 'd1', disabled: true },
        { label: 'Disabled 2', value: 'd2', disabled: true },
        { label: 'Disabled 3', value: 'd3', disabled: true },
        { label: 'Last', value: '5' },
      ]
      const config = createConfig({ choices })
      const promise = select(config)

      // why: Down should skip all disabled and land on Last
      await input.sendKeys(Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: '5' })
    })

    it('skips multiple consecutive disabled items when navigating up', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'First', value: '1' },
        { label: 'Disabled 1', value: 'd1', disabled: true },
        { label: 'Disabled 2', value: 'd2', disabled: true },
        { label: 'Disabled 3', value: 'd3', disabled: true },
        { label: 'Last', value: '5' },
      ]
      const config = createConfig({ choices, initial: 4 })
      const promise = select(config)

      // why: Up should skip all disabled and land on First
      await input.sendKeys(Key.Up, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: '1' })
    })

    it('shows scroll down indicator at top of long list', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 0 })
      const promise = select(config)

      await input.sendKeys(Key.Enter)
      await promise

      const data = output.text()

      expect(data).toContain('more below')
    })

    it('adjusts scroll offset when cursor moves above visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 7 })
      const promise = select(config)

      // why: Navigate up multiple times to force scroll offset adjustment
      await input.sendKeys(Key.Up, Key.Up, Key.Up, Key.Up, Key.Up, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'opt3' })
    })

    it('adjusts scroll offset when cursor moves below visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 0 })
      const promise = select(config)

      // why: Navigate down many times to force scroll offset adjustment
      const keys: Key[] = Array.from({ length: 12 }, () => Key.Down)
      keys.push(Key.Enter)
      await input.sendKeys(...keys)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'opt13' })
    })
  })

  describe('paste', () => {
    it('ignores pasted text when not searchable', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys('pasted text', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'red' })
    })
  })

  describe('resize', () => {
    it('repaints the list preserving the cursor when the terminal resizes', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.Down)
      await flushPromises()

      const before = output.text().length
      output.emit('resize')
      await flushPromises()
      const repaint = output.text().slice(before)

      await input.sendKeys(Key.Enter)
      await promise

      // why: the repaint after resize draws the pointer on the choice focused before the resize
      expect(stripAnsi(repaint)).toContain('❯ Green')
    })

    it('submits the choice focused before the terminal resized', async () => {
      const config = createConfig()
      const promise = select(config)

      await input.sendKeys(Key.Down)
      await flushPromises()

      output.emit('resize')
      await flushPromises()

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result.value).toBe('green')
    })

    it('caps the visible window to the terminal height', async () => {
      output.rows = 8
      const manyChoices: ReadonlyArray<Choice<string>> = Array.from({ length: 6 }, (_, i) => ({
        label: `Row ${i + 1}`,
        value: `row${i + 1}`,
      }))
      const config = createConfig({ choices: manyChoices })
      const promise = select(config)

      await input.sendKeys(Key.Enter)
      await promise

      // why: eight rows leave a four-item window, so two of six overflow
      expect(output.text()).toContain('(2 more below)')
    })
  })
})
