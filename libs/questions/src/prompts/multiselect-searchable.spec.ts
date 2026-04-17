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

describe('multiselect searchable mode', () => {
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

  describe('filtering', () => {
    it('filters choices by typed text', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: type 'ban' to filter to Banana
      input.enqueueKeys(['b', 'a', 'n', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['banana'])
    })

    it('shows no matches message', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      input.enqueueKeys(['x', 'y', 'z', Key.CtrlC])
      await promise

      expect(output.getWrittenData()).toContain('No matches')
    })

    it('clears filter with backspace', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: type 'xy' (no matches), backspace twice, type 'a' to filter
      input.enqueueKeys(['x', 'y', Key.Backspace, Key.Backspace, 'a', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      // why: first match for 'a' is Apple
      expect(result.value).toEqual(['apple'])
    })

    it('shows filter hint when searchable', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Space, Key.Enter])
      await promise

      expect(output.getWrittenData()).toContain('type to filter')
    })

    it('handles space in search correctly', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: space toggles selection, not adds to filter
      input.enqueueKeys(['a', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })

    it('backspace does nothing on empty filter', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      input.enqueueKeys([Key.Backspace, Key.Backspace, Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })

    it('handles alternate backspace character', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      input.enqueueKeys(['x', '\b', 'a', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })

    it('handles non-searchable mode ignoring typed keys', async () => {
      const config = createConfig({ searchable: false })
      const promise = multiselect(config)

      // why: typing doesn't filter when not searchable
      input.enqueueKeys(['a', 'b', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })

    it('resets cursor on filter change', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: navigate down, then type to filter, cursor resets to 0
      input.enqueueKeys([Key.Down, Key.Down, 'c', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      // why: 'c' matches Cherry
      expect(result.value).toEqual(['cherry'])
    })
  })

  describe('filtered navigation', () => {
    it('handles navigation with empty filtered choices', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: filter to no results, try navigation
      input.enqueueKeys(['z', 'z', 'z', Key.Down, Key.Up, Key.Space, Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })

    it('handles cursor beyond filtered indices on space press', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: Filter to very few results then press space when filtered list is small
      input.enqueueKeys(['z', 'z', Key.Space, Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
    })
  })

  describe('display', () => {
    it('displays search query text in searchable mode', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: Type some characters to show the search query display
      input.enqueueKeys(['a', 'p', Key.Space, Key.Enter])
      await promise

      const data = output.getWrittenData()

      // why: Should show both the query and the filter hint
      expect(data).toContain('ap')
      expect(data).toContain('type to filter')
    })

    it('handles filter clearing empty query via alternate backspace', async () => {
      const config = createConfig({ searchable: true })
      const promise = multiselect(config)

      // why: Test alternate backspace on empty query does nothing
      input.enqueueKeys(['\b', '\b', Key.Space, Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toEqual(['apple'])
    })
  })
})
