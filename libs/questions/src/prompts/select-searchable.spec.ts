import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import type { SelectConfig, Choice } from '../types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { select } from './select'

const basicChoices: ReadonlyArray<Choice<string>> = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('select searchable mode', () => {
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
      message: 'Pick a fruit:',
      choices: basicChoices,
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream,
      ...overrides,
    }) as SelectConfig<T>

  describe('filtering', () => {
    it('filters choices by typed text and selects first match', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: type 'ban' narrows to Banana; Enter submits
      await input.sendKeys('b', 'a', 'n', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'banana' })
    })

    it('is case-insensitive', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys('C', 'H', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'cherry' })
    })

    it('clears filter with backspace and re-filters', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: type 'xy' (no matches), backspace twice clears, 'a' matches Apple first
      await input.sendKeys('x', 'y', Key.Backspace, Key.Backspace, 'a', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'apple' })
    })

    it('backspace does nothing on empty filter', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys(Key.Backspace, Key.Backspace, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'apple' })
    })

    it('handles alternate backspace character', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys('x', '\b', 'a', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'apple' })
    })

    it('resets cursor when filter changes', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: navigate down twice, then type narrows to Cherry (cursor resets to 0)
      await input.sendKeys(Key.Down, Key.Down, 'c', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'cherry' })
    })

    it('shows no matches message', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys('z', 'z', 'z', Key.CtrlC)
      await promise

      expect(output.text()).toContain('No matches')
    })

    it('shows filter hint when searchable and empty query', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys(Key.Enter)
      await promise

      expect(output.text()).toContain('type to filter')
    })

    it('displays search query text', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys('a', 'p', Key.Enter)
      await promise

      const data = output.text()

      expect(data).toContain('ap')
    })

    it('ignores typed keys when searchable is false', async () => {
      const config = createConfig({ searchable: false })
      const promise = select(config)

      // why: typing does not filter; Enter selects the default first choice
      await input.sendKeys('b', 'a', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'apple' })
    })

    it('Enter is a no-op when filter excludes all choices', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: 'zzz' leaves no matches; Enter should not submit; backspace opens a match; Enter then submits Apple
      await input.sendKeys('z', 'z', 'z', Key.Enter, Key.Backspace, Key.Backspace, Key.Backspace, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'apple' })
    })

    it('handles alternate backspace on empty query', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys('\b', '\b', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'apple' })
    })
  })

  describe('filtered navigation and scrolling', () => {
    const manyChoices: ReadonlyArray<Choice<string>> = Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `opt${i + 1}`,
    }))

    it('scrolls within filtered result set', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 3, searchable: true })
      const promise = select(config)

      // why: filter to options containing '1' → Option 1, Option 10..19 (11 items).
      await input.sendKeys('1', Key.Down, Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'opt11' })
    })

    it('renders scroll indicators when filtered list overflows visible window', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 3, searchable: true })
      const promise = select(config)

      // why: filter '1' yields 11 matches; with maxVisible=3 we should see "more below"
      await input.sendKeys('1', Key.CtrlC)
      await promise

      expect(output.text()).toContain('more below')
    })

    it('skips disabled items within filtered results when navigating down', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'Apple', value: 'apple' },
        { label: 'Apricot', value: 'apricot', disabled: true },
        { label: 'Avocado', value: 'avocado' },
      ]
      const config = createConfig({ choices, searchable: true })
      const promise = select(config)

      // why: filter 'a' keeps all three; Down from Apple should skip disabled Apricot onto Avocado
      await input.sendKeys('a', Key.Down, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'avocado' })
    })

    it('skips disabled items within filtered results when navigating up', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'Apple', value: 'apple' },
        { label: 'Apricot', value: 'apricot', disabled: true },
        { label: 'Avocado', value: 'avocado' },
      ]
      const config = createConfig({ choices, searchable: true })
      const promise = select(config)

      // why: filter 'a', down to Avocado, Up skips disabled Apricot back to Apple
      await input.sendKeys('a', Key.Down, Key.Up, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'apple' })
    })

    it('ignores navigation when filter yields no matches', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: filter to empty, Up/Down are no-ops, Ctrl+C cancels
      await input.sendKeys('z', 'z', 'z', Key.Down, Key.Up, Key.CtrlC)

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })

    it('adjusts scroll offset on upward navigation in filtered set', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 3, searchable: true })
      const promise = select(config)

      // why: filter '1' (11 matches), navigate deep down then back up to force scroll reset
      const keys = ['1', Key.Down, Key.Down, Key.Down, Key.Down, Key.Up, Key.Up, Key.Up, Key.Up, Key.Enter]
      await input.sendKeys(...keys)

      const result = await promise

      // why: after down*4 then up*4 cursor is back on first match (Option 1)
      expect(result).toEqual({ result: PromptResult.Submitted, value: 'opt1' })
    })
  })

  describe('paste', () => {
    it('appends a bracketed paste first line to the filter', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys('\x1B[200~ban\nana\x1B[201~', Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: 'banana' })
    })

    it('appends a non-bracketed pasted run to the filter', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: a multi-character chunk is treated as a paste and filters at once
      await input.sendKeys('ban', Key.Enter)

      const result = await promise

      expect(result.value).toBe('banana')
    })

    it('ignores a paste whose first line has no printable characters', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      await input.sendKeys('\x1B[200~\nban\x1B[201~', 'b', Key.Enter)

      const result = await promise

      expect(result.value).toBe('banana')
    })
  })
})
