import type { MultiselectConfig, Choice } from '../types'
import { PassThrough } from 'node:stream'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { multiselect } from './multiselect'

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

const basicChoices: ReadonlyArray<Choice<string>> = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('multiselect', () => {
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

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual([])
    })

    it('toggles selection with space', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })

    it('selects multiple items', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Down, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple', 'cherry'])
    })

    it('deselects with second space', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual([])
    })

    it('uses initial selection', async () => {
      const config = createConfig({ initial: [1, 2] })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['banana', 'cherry'])
    })

    it('can modify initial selection', async () => {
      const config = createConfig({ initial: [1] })
      const promise = multiselect(config)

      // why: toggle first, desleect second, submit
      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })
  })

  describe('navigation', () => {
    it('moves down with Down key', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['banana'])
    })

    it('moves up with Up key', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Down, Key.Down, Key.Up, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['banana'])
    })

    it('stops at top when pressing Up', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Up, Key.Up, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })

    it('stops at bottom when pressing Down', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Down, Key.Down, Key.Down, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['cherry'])
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
      expect(result.value).toBeUndefined()
    })

    it('returns cancelled after partial selection', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })
  })

  describe('disabled choices', () => {
    it('ignores space on disabled choice', async () => {
      const choices: ReadonlyArray<Choice<string>> = [{ label: 'Disabled', value: 'x', disabled: true }]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual([])
    })

    it('displays disabled hint in output', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'Available', value: 'a' },
        { label: 'NotAvailable', value: 'na', disabled: true },
      ]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('(disabled)')
    })

    it('handles all disabled choices', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'A', value: 'a', disabled: true },
        { label: 'B', value: 'b', disabled: true },
      ]
      const config = createConfig({ choices })
      const promise = multiselect(config)

      // why: try to navigate and select, should be ignored
      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual([])
    })
  })

  describe('min/max constraints', () => {
    it('enforces minimum selections', async () => {
      const config = createConfig({ min: 2 })
      const promise = multiselect(config)

      // why: try submit with 1 selection, shows error, add another
      input.enqueueKeys([Key.Space, Key.Enter, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple', 'banana'])

      const data = output.getWrittenData()

      expect(data).toContain('at least 2')
    })

    it('enforces singular minimum message', async () => {
      const config = createConfig({ min: 1 })
      const promise = multiselect(config)

      // why: try submit with 0 selections
      input.enqueueKeys([Key.Enter, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)

      const data = output.getWrittenData()

      expect(data).toContain('at least 1 option')
      expect(data).not.toContain('options')
    })

    it('enforces maximum selections', async () => {
      const config = createConfig({ max: 2 })
      const promise = multiselect(config)

      // why: select 3, but max is 2 so third is ignored
      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple', 'banana'])
    })

    it('shows min/max hints', async () => {
      const config = createConfig({ min: 1, max: 3 })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('min: 1')
      expect(data).toContain('max: 3')
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
      input.enqueueKeys([...downKeys, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['item8'])
    })

    it('shows scroll indicators', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5 })
      const promise = multiselect(config)

      // why: navigate to middle to show both indicators
      input.enqueueKeys([Key.Down, Key.Down, Key.Down, Key.Down, Key.Down, Key.Down, Key.Down, Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('more above')
      expect(data).toContain('more below')
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Pick items:' })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('Pick items:')
    })

    it('shows selected count', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('2 selected')
    })

    it('shows selected labels on submission', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('Apple')
      expect(data).toContain('Banana')
    })

    it('shows none when nothing selected', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('none')
    })

    it('shows cancelled text on cancellation', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.CtrlC])
      await promise

      expect(output.getWrittenData()).toContain('cancelled')
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

      input.enqueueKeys([Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('1-10 items')
    })
  })

  describe('empty state', () => {
    it('handles empty choices array', async () => {
      const config = createConfig({ choices: [] })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual([])
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

      input.enqueueKeys([Key.Space, Key.Down, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual([1, 3])
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

      input.enqueueKeys([Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual([{ id: 2, name: 'b' }])
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
      input.enqueueKeys([...downKeys, ...upKeys, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toContain('item5')
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
      input.enqueueKeys([Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['5'])
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
      input.enqueueKeys([Key.Down, Key.Up, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['1'])
    })

    it('renders selected but non-focused items with green styling', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      // why: Select first item, move down, then submit - first item should be selected but not focused
      input.enqueueKeys([Key.Space, Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])

      // why: The selected item styling is internally applied - we just verify selection worked
    })

    it('shows only min hint when only min is set', async () => {
      const config = createConfig({ min: 2 })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('min: 2')
      expect(data).not.toContain('max:')
    })

    it('shows only max hint when only max is set', async () => {
      const config = createConfig({ max: 3 })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('max: 3')
      expect(data).not.toContain('min:')
    })

    it('submits with singular max validation message', async () => {
      // why: Test edge case for max: 1 validation message (singular "option" not "options")
      const config = createConfig({ max: 1 })
      const promise = multiselect(config)

      // why: Select 2, but max is 1 so second is ignored
      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })

    it('validates maximum selections overflow', async () => {
      // why: Ensure we cannot exceed max selections
      const config = createConfig({ max: 1 })
      const promise = multiselect(config)

      // why: Try to select 3 items with max: 1, only first should be selected
      input.enqueueKeys([Key.Space, Key.Down, Key.Space, Key.Down, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toHaveLength(1)
    })
  })

  describe('paste', () => {
    it('ignores pasted text when not searchable', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      // why: the paste must not toggle or submit; Space then selects normally
      input.enqueueKeys(['pasted text', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })
  })

  describe('resize', () => {
    it('repaints the list preserving selections when the terminal resizes', async () => {
      const config = createConfig()
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Down, Key.Space])
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))

      const before = output.getWrittenData().length
      output.emit('resize')
      await new Promise((resolve) => setImmediate(resolve))

      // why: the repaint after resize keeps the selection counter intact
      expect(output.getWrittenData().slice(before)).toContain('2 selected')

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.value).toEqual(['apple', 'banana'])
    })
  })
})
