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
function createMockOutput(): PassThrough & { getWrittenData: () => string } {
  const output = new PassThrough() as PassThrough & { getWrittenData: () => string }
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

describe('select searchable mode', () => {
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
      input.enqueueKeys(['b', 'a', 'n', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('banana')
    })

    it('is case-insensitive', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      input.enqueueKeys(['C', 'H', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('cherry')
    })

    it('clears filter with backspace and re-filters', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: type 'xy' (no matches), backspace twice clears, 'a' matches Apple first
      input.enqueueKeys(['x', 'y', Key.Backspace, Key.Backspace, 'a', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('apple')
    })

    it('backspace does nothing on empty filter', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      input.enqueueKeys([Key.Backspace, Key.Backspace, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('apple')
    })

    it('handles alternate backspace character', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      input.enqueueKeys(['x', '\b', 'a', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('apple')
    })

    it('resets cursor when filter changes', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: navigate down twice, then type narrows to Cherry (cursor resets to 0)
      input.enqueueKeys([Key.Down, Key.Down, 'c', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('cherry')
    })

    it('shows no matches message', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      input.enqueueKeys(['z', 'z', 'z', Key.CtrlC])
      await promise

      expect(output.getWrittenData()).toContain('No matches')
    })

    it('shows filter hint when searchable and empty query', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      input.enqueueKeys([Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('type to filter')
    })

    it('displays search query text', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      input.enqueueKeys(['a', 'p', Key.Enter])
      await promise

      const data = output.getWrittenData()

      expect(data).toContain('ap')
    })

    it('ignores typed keys when searchable is false', async () => {
      const config = createConfig({ searchable: false })
      const promise = select(config)

      // why: typing does not filter; Enter selects the default first choice
      input.enqueueKeys(['b', 'a', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('apple')
    })

    it('Enter is a no-op when filter excludes all choices', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: 'zzz' leaves no matches; Enter should not submit; backspace opens a match; Enter then submits Apple
      input.enqueueKeys(['z', 'z', 'z', Key.Enter, Key.Backspace, Key.Backspace, Key.Backspace, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('apple')
    })

    it('handles alternate backspace on empty query', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      input.enqueueKeys(['\b', '\b', Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('apple')
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
      input.enqueueKeys(['1', Key.Down, Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('opt11')
    })

    it('renders scroll indicators when filtered list overflows visible window', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 3, searchable: true })
      const promise = select(config)

      // why: filter '1' yields 11 matches; with maxVisible=3 we should see "more below"
      input.enqueueKeys(['1', Key.CtrlC])
      await promise

      expect(output.getWrittenData()).toContain('more below')
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
      input.enqueueKeys(['a', Key.Down, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('avocado')
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
      input.enqueueKeys(['a', Key.Down, Key.Up, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe('apple')
    })

    it('ignores navigation when filter yields no matches', async () => {
      const config = createConfig({ searchable: true })
      const promise = select(config)

      // why: filter to empty, Up/Down are no-ops, Ctrl+C cancels
      input.enqueueKeys(['z', 'z', 'z', Key.Down, Key.Up, Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })

    it('adjusts scroll offset on upward navigation in filtered set', async () => {
      const config = createConfig({ choices: manyChoices, maxVisible: 3, searchable: true })
      const promise = select(config)

      // why: filter '1' (11 matches), navigate deep down then back up to force scroll reset
      const keys = ['1', Key.Down, Key.Down, Key.Down, Key.Down, Key.Up, Key.Up, Key.Up, Key.Up, Key.Enter]
      input.enqueueKeys(keys)

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      // why: after down*4 then up*4 cursor is back on first match (Option 1)
      expect(result.value).toBe('opt1')
    })
  })
})
