import type { CapturedOutput, TtyInput } from '@hyperfrontend/testing/process'
import type { MultiselectConfig, Choice } from '../types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { stripAnsi } from '../ansi-text'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { multiselect } from './multiselect'

const basicChoices: ReadonlyArray<Choice<string>> = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('multiselect searchable mode', () => {
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

  describe('filtering', () => {
    it('filters choices by typed text', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: type 'ban' to filter to Banana
      await input.sendKeys('b', 'a', 'n', Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['banana'] })
    })

    it('shows no matches message', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      await input.sendKeys('x', 'y', 'z', Key.CtrlC)
      await promise

      expect(output.text()).toContain('No matches')
    })

    it('clears filter with backspace', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: type 'xy' (no matches), backspace twice, type 'a' to filter
      await input.sendKeys('x', 'y', Key.Backspace, Key.Backspace, 'a', Key.Space, Key.Enter)

      const result = await promise

      // why: first match for 'a' is Apple
      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('shows filter hint when searchable', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      await input.sendKeys(Key.Space, Key.Enter)
      await promise

      expect(output.text()).toContain('type to filter')
    })

    it('handles space in search correctly', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: space toggles selection, not adds to filter
      await input.sendKeys('a', Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('backspace does nothing on empty filter', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      await input.sendKeys(Key.Backspace, Key.Backspace, Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('handles alternate backspace character', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      await input.sendKeys('x', '\b', 'a', Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('handles non-searchable mode ignoring typed keys', async () => {
      const config = createConfig({ searchable: false })
      const promise = multiselect(config)

      // why: typing doesn't filter when not searchable
      await input.sendKeys('a', 'b', Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })

    it('resets cursor on filter change', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: navigate down, then type to filter, cursor resets to 0
      await input.sendKeys(Key.Down, Key.Down, 'c', Key.Space, Key.Enter)

      const result = await promise

      // why: 'c' matches Cherry
      expect(result).toEqual({ result: PromptResult.Submitted, value: ['cherry'] })
    })
  })

  describe('filtered navigation', () => {
    it('handles navigation with empty filtered choices', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: filter to no results, try navigation
      await input.sendKeys('z', 'z', 'z', Key.Down, Key.Up, Key.Space, Key.CtrlC)

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })

    it('handles cursor beyond filtered indices on space press', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: Filter to very few results then press space when filtered list is small
      await input.sendKeys('z', 'z', Key.Space, Key.CtrlC)

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })
  })

  describe('display', () => {
    it('displays search query text in searchable mode', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: Type some characters to show the search query display
      await input.sendKeys('a', 'p', Key.Space, Key.Enter)
      await promise

      // why: the header renders the query followed by the filter hint
      expect(stripAnsi(output.text())).toContain('ap (type to filter)')
    })

    it('handles filter clearing empty query via alternate backspace', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: Test alternate backspace on empty query does nothing
      await input.sendKeys('\b', '\b', Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['apple'] })
    })
  })

  describe('paste', () => {
    it('appends the first pasted line to the filter and keeps Space toggling', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: the paste filters to Banana; Space still toggles the focused item
      await input.sendKeys('\x1B[200~ban\nana\x1B[201~', Key.Space, Key.Enter)

      const result = await promise

      expect(result).toEqual({ result: PromptResult.Submitted, value: ['banana'] })
    })

    it('appends a non-bracketed pasted run to the filter', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      await input.sendKeys('che', Key.Space, Key.Enter)

      const result = await promise

      expect(result.value).toEqual(['cherry'])
    })

    it('ignores a paste whose first line has no printable characters', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      await input.sendKeys('\x1B[200~\nban\x1B[201~', Key.Space, Key.Enter)

      const result = await promise

      expect(result.value).toEqual(['apple'])
    })
  })
})
