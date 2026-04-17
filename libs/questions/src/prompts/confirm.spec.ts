import type { ConfirmConfig } from '../types'
import { PassThrough } from 'node:stream'
import { Key } from '../terminal'
import { PromptResult } from '../types'
import { confirm } from './confirm'

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

describe('confirm', () => {
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

      input.enqueueKeys(['y'])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(true)
    })

    it('returns true for uppercase Y', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys(['Y'])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(true)
    })
  })

  describe('no response', () => {
    it('returns false for lowercase n', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys(['n'])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(false)
    })

    it('returns false for uppercase N', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys(['N'])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(false)
    })
  })

  describe('cancellation', () => {
    it('returns cancelled result on Ctrl+C', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys([Key.CtrlC])

      const result = await promise

      expect(result.result).toBe(PromptResult.Cancelled)
      expect(result.value).toBeUndefined()
    })
  })

  describe('default value', () => {
    it('returns initial true on Enter', async () => {
      const config = createConfig({ initial: true })
      const promise = confirm(config)

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(true)
    })

    it('returns initial false on Enter', async () => {
      const config = createConfig({ initial: false })
      const promise = confirm(config)

      input.enqueueKeys([Key.Enter])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(false)
    })

    it('ignores Enter when no initial provided', async () => {
      const config = createConfig({ initial: undefined })
      const promise = confirm(config)

      // why: Enter is ignored, then y is pressed
      input.enqueueKeys([Key.Enter, 'y'])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(true)
    })
  })

  describe('invalid keys', () => {
    it('ignores invalid keys and waits for valid input', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys(['x', 'z', '1', 'y'])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(true)
    })

    it('ignores arrow keys', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys([Key.Up, Key.Down, Key.Left, Key.Right, 'n'])

      const result = await promise

      expect(result.result).toBe(PromptResult.Submitted)
      expect(result.value).toBe(false)
    })
  })

  describe('output', () => {
    it('writes message to output', async () => {
      const config = createConfig({ message: 'Proceed?' })
      const promise = confirm(config)

      input.enqueueKeys(['y'])
      await promise

      expect(output.getWrittenData()).toContain('Proceed?')
    })

    it('shows Y/n when initial is true', async () => {
      const config = createConfig({ initial: true })
      const promise = confirm(config)

      input.enqueueKeys(['y'])
      await promise

      expect(output.getWrittenData()).toContain('Y/n')
    })

    it('shows y/N when initial is false', async () => {
      const config = createConfig({ initial: false })
      const promise = confirm(config)

      input.enqueueKeys(['n'])
      await promise

      expect(output.getWrittenData()).toContain('y/N')
    })

    it('shows y/n when no initial provided', async () => {
      const config = createConfig({ initial: undefined })
      const promise = confirm(config)

      input.enqueueKeys(['y'])
      await promise

      expect(output.getWrittenData()).toContain('y/n')
    })

    it('shows Yes when confirmed', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys(['y'])
      await promise

      expect(output.getWrittenData()).toContain('Yes')
    })

    it('shows No when declined', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys(['n'])
      await promise

      expect(output.getWrittenData()).toContain('No')
    })

    it('shows cancelled when cancelled', async () => {
      const config = createConfig()
      const promise = confirm(config)

      input.enqueueKeys([Key.CtrlC])
      await promise

      expect(output.getWrittenData()).toContain('cancelled')
    })
  })
})
