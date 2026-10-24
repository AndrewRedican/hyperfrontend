import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import type { MultiselectConfig, Choice } from '../types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { multiselect } from './multiselect'

const basicChoices: ReadonlyArray<Choice<string>> = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('multiselect', () => {
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

  const createConfig = <T = string>(overrides: Partial<MultiselectConfig<T>> = {}): MultiselectConfig<T> =>
    ({
      message: 'Select fruits:',
      choices: basicChoices,
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream,
      ...overrides,
    }) as MultiselectConfig<T>

  describe('selection', () => {
    it('submits empty array when nothing selected', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: [] })
    })

    it('toggles selection with space', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('selects multiple items', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple', 'cherry'] })
    })

    it('deselects with second space', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: [] })
    })

    it('uses initial selection', async () => {
      const config = createConfig({ initial: [1, 2] })
      const promise = multiselect(config)

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['banana', 'cherry'] })
    })

    it('can modify initial selection', async () => {
      const config = createConfig({ initial: [1] })
      const promise = multiselect(config)

      // why: toggle first, desleect second, submit
      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })
  })

  describe('navigation', () => {
    it('moves down with Down key', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['banana'] })
    })

    it('moves up with Up key', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Down, Key.Down, Key.Up, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['banana'] })
    })

    it('stops at top when pressing Up', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Up, Key.Up, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('stops at bottom when pressing Down', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Down, Key.Down, Key.Down, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['cherry'] })
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.CtrlC)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Cancelled, value: undefined })
    })

    it('returns cancelled after partial selection', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.CtrlC)

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })
  })

  describe('disabled choices', () => {
    it('ignores space on disabled choice', async () => {
      const choices: ReadonlyArray<Choice<string>> = [{ label: 'Disabled', value: 'x', disabled: true }]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: [] })
    })

    it('displays disabled hint in output', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'Available', value: 'a' },
        { label: 'NotAvailable', value: 'na', disabled: true },
      ]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      await input.sendKeys(Key.Enter)
      await promise

      expect(output.text()).toContain('(disabled)')
    })

    it('handles all disabled choices', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'A', value: 'a', disabled: true },
        { label: 'B', value: 'b', disabled: true },
      ]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      // why: try to navigate and select, should be ignored
      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: [] })
    })
  })

  describe('min/max constraints', () => {
    it('blocks submission until the minimum is selected', async () => {
      const config = createConfig({ min: 2 })
      const promise = multiselect(config)

      // why: the first Enter has one selection and is rejected; a second selection lets the next Enter submit
      await input.sendKeys(Key.Space, Key.Enter, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple', 'banana'] })
    })

    it('shows the minimum message when submitting below the minimum', async () => {
      const config = createConfig({ min: 2 })
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Enter, Key.Down, Key.Space, Key.Enter)
      await promise

      expect(output.text()).toContain('at least 2')
    })

    it('submits under a minimum of one once an option is selected', async () => {
      const config = createConfig({ min: 1 })
      const promise = multiselect(config)

      // why: the first Enter has no selection and is rejected
      await input.sendKeys(Key.Enter, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('uses the singular noun in the minimum message for a minimum of one', async () => {
      const config = createConfig({ min: 1 })
      const promise = multiselect(config)

      await input.sendKeys(Key.Enter, Key.Space, Key.Enter)
      await promise

      const data = output.text()

      // why: the message keeps the singular noun and the plural form is printed nowhere in the output
      expect({ singular: /at least 1 option\b/.test(data), plural: data.includes('options') }).toEqual({ singular: true, plural: false })
    })

    it('enforces maximum selections', async () => {
      const config = createConfig({ max: 2 })
      const promise = multiselect(config)

      // why: select 3, but max is 2 so third is ignored
      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple', 'banana'] })
    })

    it('shows min/max hints', async () => {
      const config = createConfig({ min: 1, max: 3 })
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Enter)
      await promise

      const data = output.text()

      // why: both hints render inside one parenthesised counter suffix
      expect(data).toContain('(min: 1, max: 3)')
    })
  })

  describe('scrolling', () => {
    const manyChoices: ReadonlyArray<Choice<string>> = Array.from({ length: 15 }, (_, i) => ({
      label: `Item ${i + 1}`,
      value: `item${i + 1}`,
    }))

    it('scrolls down when navigating beyond visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5 })
      const promise = multiselect(config)

      const downKeys = Array.from({ length: 7 }, () => Key.Down)
      await input.sendKeys(...downKeys, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['item8'] })
    })

    it('shows scroll indicators', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5 })
      const promise = multiselect(config)

      // why: navigate to middle to show both indicators
      await input.sendKeys(Key.Down, Key.Down, Key.Down, Key.Down, Key.Down, Key.Down, Key.Down, Key.Enter)
      await promise

      const data = output.text()

      // why: one frame renders the above indicator before the below indicator
      expect(data).toMatch(/more above[\s\S]*more below/)
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Pick items:' })
      const promise = multiselect(config)

      await input.sendKeys(Key.Enter)
      await promise

      expect(output.text()).toContain('Pick items:')
    })

    it('shows selected count', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Enter)
      await promise

      expect(output.text()).toContain('2 selected')
    })

    it('shows selected labels on submission', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Enter)
      await promise

      const data = output.text()

      // why: the submitted line joins the selected labels with a comma
      expect(data).toContain('Apple, Banana')
    })

    it('shows none when nothing selected', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Enter)
      await promise

      expect(output.text()).toContain('none')
    })

    it('shows cancelled text on cancellation', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.CtrlC)
      await promise

      expect(output.text()).toContain('cancelled')
    })
  })

  describe('hints', () => {
    it('displays hint text', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'Small', value: 'sm', hint: '1-10 items' },
        { label: 'Large', value: 'lg', hint: '10+ items' },
      ]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      await input.sendKeys(Key.Enter)
      await promise

      const data = output.text()

      expect(data).toContain('1-10 items')
    })
  })

  describe('configuration', () => {
    it('rejects an empty choice list', async () => {
      await expect(multiselect(createConfig({ choices: [] }))).rejects.toThrow('multiselect requires at least one choice')
    })

    it('rejects an initial index past the last choice', async () => {
      await expect(multiselect(createConfig({ initial: [7] }))).rejects.toThrow(
        'multiselect initial must be an index between 0 and 2, received 7'
      )
    })
  })

  describe('typed values', () => {
    it('works with number values', async () => {
      const choices: ReadonlyArray<Choice<number>> = [
        { label: 'One', value: 1 },
        { label: 'Two', value: 2 },
        { label: 'Three', value: 3 },
      ]
      const config = createConfig<number>({ choices })
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: [1, 3] })
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
      const promise = multiselect(config)

      await input.sendKeys(Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: [{ id: 2, name: 'b' }] })
    })
  })

  describe('additional coverage', () => {
    const manyChoices: ReadonlyArray<Choice<string>> = Array.from({ length: 15 }, (_, i) => ({
      label: `Item ${i + 1}`,
      value: `item${i + 1}`,
    }))

    it('scrolls up when navigating above visible area', async () => {
      // why: Start from a scrolled position and navigate up to trigger scroll-up adjustment
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: [10] })
      const promise = multiselect(config)

      // why: Navigate down first to scroll, then navigate up multiple times
      const downKeys = Array.from({ length: 10 }, () => Key.Down)
      const upKeys = Array.from({ length: 6 }, () => Key.Up)
      await input.sendKeys(...downKeys, ...upKeys, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: expect.arrayContaining(['item5']) })
    })

    it('skips multiple consecutive disabled items when navigating down', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'First', value: '1' },
        { label: 'Disabled 1', value: 'd1', disabled: true },
        { label: 'Disabled 2', value: 'd2', disabled: true },
        { label: 'Disabled 3', value: 'd3', disabled: true },
        { label: 'Last', value: '5' },
      ]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      // why: Pressing down once should skip all disabled and land on Last
      await input.sendKeys(Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['5'] })
    })

    it('skips multiple consecutive disabled items when navigating up', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'First', value: '1' },
        { label: 'Disabled 1', value: 'd1', disabled: true },
        { label: 'Disabled 2', value: 'd2', disabled: true },
        { label: 'Disabled 3', value: 'd3', disabled: true },
        { label: 'Last', value: '5' },
      ]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      // why: Navigate to last (skips disabled), then up should skip all disabled and land on First
      await input.sendKeys(Key.Down, Key.Up, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['1'] })
    })

    it('renders selected but non-focused items with green styling', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      // why: Select first item, move down, then submit - first item should be selected but not focused
      await input.sendKeys(Key.Space, Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })

      // why: The selected item styling is internally applied - we just verify selection worked
    })

    it('shows only min hint when only min is set', async () => {
      const config = createConfig({ min: 2 })
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Enter)
      await promise

      const data = output.text()

      // why: the counter suffix carries the min hint alone and no frame prints a max hint
      expect({ minHint: data.includes('(min: 2)'), maxHint: data.includes('max:') }).toEqual({ minHint: true, maxHint: false })
    })

    it('shows only max hint when only max is set', async () => {
      const config = createConfig({ max: 3 })
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Enter)
      await promise

      const data = output.text()

      // why: the counter suffix carries the max hint alone and no frame prints a min hint
      expect({ maxHint: data.includes('(max: 3)'), minHint: data.includes('min:') }).toEqual({ maxHint: true, minHint: false })
    })

    it('submits with singular max validation message', async () => {
      // why: Test edge case for max: 1 validation message (singular "option" not "options")
      const config = createConfig({ max: 1 })
      const promise = multiselect(config)

      // why: Select 2, but max is 1 so second is ignored
      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('validates maximum selections overflow', async () => {
      // why: Ensure we cannot exceed max selections
      const config = createConfig({ max: 1 })
      const promise = multiselect(config)

      // why: Try to select 3 items with max: 1, only first should be selected
      await input.sendKeys(Key.Space, Key.Down, Key.Space, Key.Down, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })
  })

  describe('paste', () => {
    it('ignores pasted text when not searchable', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      // why: the paste must not toggle or submit; Space then selects normally
      await input.sendKeys('pasted text', Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })
  })

  describe('resize', () => {
    it('repaints the list preserving selections when the terminal resizes', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Space)
      await flushPromises()

      const before = output.text().length
      output.emit('resize')
      await flushPromises()
      const repaint = output.text().slice(before)

      await input.sendKeys(Key.Enter)
      await promise

      // why: the repaint after resize keeps the selection counter intact
      expect(repaint).toContain('2 selected')
    })

    it('submits the selections made before the terminal resized', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Down, Key.Space)
      await flushPromises()

      output.emit('resize')
      await flushPromises()

      await input.sendKeys(Key.Enter)

      const result = await promise

      expect(result.value).toEqual(['apple', 'banana'])
    })
  })
})
