import { beforeEach } from 'node:test'
import { select, text } from '@hyperfrontend/questions'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { promptContractPath, promptEntryFile, promptFeatureName } from './prompts'

jest.mock('@hyperfrontend/questions', () => ({
  PromptResult: { Submitted: 'submitted', Cancelled: 'cancelled' },
  select: jest.fn(),
  text: jest.fn(),
}))

const mockText = jest.mocked(text)
const mockSelect = jest.mocked(select)

const outcome = (result: string, value?: string): never => ({ result, value }) as never

const readTextValidate = (): ((value: string) => string | undefined) => {
  const validate = mockText.mock.calls[0]?.[0]?.validate
  if (validate === undefined) throw new Error('text was called without a validate')
  return validate
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('promptFeatureName', () => {
  it('returns the trimmed submitted name', async () => {
    mockText.mockResolvedValue(outcome('submitted', '  clock  '))
    await expect(promptFeatureName()).resolves.toBe('clock')
  })

  it('returns null when cancelled', async () => {
    mockText.mockResolvedValue(outcome('cancelled'))
    await expect(promptFeatureName()).resolves.toBeNull()
  })

  it('rejects an empty name and accepts a non-empty one', async () => {
    mockText.mockResolvedValue(outcome('cancelled'))
    await promptFeatureName()
    const validate = readTextValidate()
    expect({ empty: validate(''), filled: validate('x') }).toEqual({ empty: 'Name must not be empty', filled: undefined })
  })
})

describe('promptContractPath', () => {
  it('returns the trimmed submitted path', async () => {
    mockText.mockResolvedValue(outcome('submitted', ' ./c.json '))
    await expect(promptContractPath()).resolves.toBe('./c.json')
  })

  it('returns null when cancelled', async () => {
    mockText.mockResolvedValue(outcome('cancelled'))
    await expect(promptContractPath()).resolves.toBeNull()
  })

  it('rejects an empty contract path and accepts a non-empty one', async () => {
    mockText.mockResolvedValue(outcome('cancelled'))
    await promptContractPath()
    const validate = readTextValidate()
    expect({ empty: validate(''), filled: validate('x') }).toEqual({ empty: 'Contract path must not be empty', filled: undefined })
  })
})

describe('promptEntryFile', () => {
  it('prompts for a manual path when there are no candidates', async () => {
    mockText.mockResolvedValue(outcome('submitted', ' src/main.ts '))
    await expect(promptEntryFile([])).resolves.toBe('src/main.ts')
  })

  it('returns the selected candidate', async () => {
    mockSelect.mockResolvedValue(outcome('submitted', 'src/main.ts'))
    await expect(promptEntryFile(['src/main.ts'])).resolves.toBe('src/main.ts')
  })

  it('returns null when the selection is cancelled', async () => {
    mockSelect.mockResolvedValue(outcome('cancelled'))
    await expect(promptEntryFile(['src/main.ts'])).resolves.toBeNull()
  })

  it('falls back to a manual path when the manual option is chosen', async () => {
    mockSelect.mockResolvedValue(outcome('submitted', '__hf_manual_entry__'))
    mockText.mockResolvedValue(outcome('submitted', 'src/custom.ts'))
    await expect(promptEntryFile(['src/main.ts'])).resolves.toBe('src/custom.ts')
  })

  it('returns null when the manual path is cancelled', async () => {
    mockText.mockResolvedValue(outcome('cancelled'))
    await expect(promptEntryFile([])).resolves.toBeNull()
  })

  it('rejects an empty manual path and accepts a non-empty one', async () => {
    mockText.mockResolvedValue(outcome('cancelled'))
    await promptEntryFile([])
    const validate = readTextValidate()
    expect({ empty: validate(''), filled: validate('x') }).toEqual({ empty: 'Entry path must not be empty', filled: undefined })
  })
})
