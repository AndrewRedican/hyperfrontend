import type { SelectConfig, Choice } from '../types'
import { PassThrough } from 'node:stream'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { select } from './select'

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
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
]

describe('select', () => {
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

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('red')
    })

    it('selects second item with Down+Enter', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys([Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('green')
    })

    it('selects third item with Down+Down+Enter', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys([Key.Down, Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('blue')
    })

    it('uses initial selection', async () => {
      const config = createConfig({ initial: 2 })
      const promise = select(config)

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('blue')
    })
  })

  describe('navigation', () => {
    it('moves up with Up key', async () => {
      const config = createConfig({ initial: 2 })
      const promise = select(config)

      input.enqueueKeys([Key.Up, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('green')
    })

    it('stops at top when pressing Up', async () => {
      const config = createConfig({ initial: 0 })
      const promise = select(config)

      input.enqueueKeys([Key.Up, Key.Up, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('red')
    })

    it('stops at bottom when pressing Down', async () => {
      const config = createConfig({ initial: 2 })
      const promise = select(config)

      input.enqueueKeys([Key.Down, Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('blue')
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

      input.enqueueKeys([Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('3')
    })

    it('skips disabled choices when navigating up', async () => {
      const choices: ReadonlyArray<Choice<string>> = [
        { label: 'One', value: '1' },
        { label: 'Two', value: '2', disabled: true },
        { label: 'Three', value: '3' },
      ]
      const config = createConfig({ choices, initial: 2 })
      const promise = select(config)

      input.enqueueKeys([Key.Up, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('1')
    })

    it('prevents selection of disabled choice on Enter', async () => {
      const choices: ReadonlyArray<Choice<string>> = [{ label: 'Disabled', value: 'x', disabled: true }]
      const config = createConfig({ choices })
      const promise = select(config)

      // why: Enter is ignored for disabled, then cancel
      input.enqueueKeys([Key.Enter, Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys([Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
      expect(result.value).toBeUndefined()
    })

    it('returns cancelled after navigation', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys([Key.Down, Key.Down, Key.CtrlC])

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
      const keys = Array.from({ length: 7 }, () => Key.Down)
      keys.push(Key.Enter)
      input.enqueueKeys(keys)

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('opt8')
    })

    it('scrolls up when navigating above visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 10 })
      const promise = select(config)

      input.enqueueKeys([Key.Up, Key.Up, Key.Up, Key.Up, Key.Up, Key.Up, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('opt5')
    })

    it('shows scroll indicators', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 7 })
      const promise = select(config)

      input.enqueueKeys([Key.Enter])
      await promise

      const data = output.getWrittenData()

      // why: middle of list should show both indicators
      expect(data).toContain('more above')
      expect(data).toContain('more below')
    })
  })

  describe('empty choices', () => {
    it('handles empty choices array', async () => {
      const config = createConfig({ choices: [] })
      const promise = select(config)

      input.enqueueKeys([Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })

    it('ignores navigation with empty choices', async () => {
      const config = createConfig({ choices: [] })
      const promise = select(config)

      // why: navigation should be ignored with empty choices
      input.enqueueKeys([Key.Up, Key.Down, Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
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

      input.enqueueKeys([Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('Free tier')
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Pick one:' })
      const promise = select(config)

      input.enqueueKeys([Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('Pick one:')
    })

    it('shows selected value on submission', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys([Key.Down, Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('Green')
    })

    it('shows cancelled text on cancellation', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys([Key.CtrlC])
      await promise

      expect(output.getWrittenData()).toContain('cancelled')
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

      input.enqueueKeys([Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(2)
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

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual({ id: 1, name: 'a' })
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
      input.enqueueKeys([Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('5')
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
      input.enqueueKeys([Key.Up, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('1')
    })

    it('shows scroll down indicator at top of long list', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 0 })
      const promise = select(config)

      input.enqueueKeys([Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('more below')
    })

    it('adjusts scroll offset when cursor moves above visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 7 })
      const promise = select(config)

      // why: Navigate up multiple times to force scroll offset adjustment
      input.enqueueKeys([Key.Up, Key.Up, Key.Up, Key.Up, Key.Up, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('opt3')
    })

    it('adjusts scroll offset when cursor moves below visible', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 5, initial: 0 })
      const promise = select(config)

      // why: Navigate down many times to force scroll offset adjustment
      const keys = Array.from({ length: 12 }, () => Key.Down)
      keys.push(Key.Enter)
      input.enqueueKeys(keys)

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('opt13')
    })
  })

  describe('paste', () => {
    it('ignores pasted text when not searchable', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys(['pasted text', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('red')
    })
  })

  describe('resize', () => {
    it('repaints the list preserving the cursor when the terminal resizes', async () => {
      const config = createConfig()
      const promise = select(config)

      input.enqueueKeys([Key.Down])
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setImmediate(resolve))

      const before = output.getWrittenData().length
      output.emit('resize')
      await new Promise((resolve) => setImmediate(resolve))

      // why: the repaint after resize re-renders every choice line
      expect(output.getWrittenData().slice(before)).toContain('Green')

      input.enqueueKeys([Key.Enter])

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

      input.enqueueKeys([Key.Enter])
      await promise

      // why: eight rows leave a four-item window, so two of six overflow
      expect(output.getWrittenData()).toContain('(2 more below)')
    })
  })
})
