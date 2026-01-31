import type { QueueCreatorValidity } from '../model'
import { getValidationError } from './get-validation-error'

describe('getValidationError', () => {
  const operationType = 'deobfuscation'
  const base: QueueCreatorValidity = {
    label: true,
    operation: true,
    logger: true,
    onSuccess: true,
    onFail: true,
  }

  it('returns an empty string if there are no validation errors', () => {
    const result = getValidationError(operationType, base)
    expect(result).toBe('')
  })

  const testCases = [
    {
      key: 'label',
      expectedMessage: 'Cannot create deobfuscation queue without a label',
    },
    {
      key: 'operation',
      expectedMessage: 'Cannot create deobfuscation queue without deobfuscation function',
    },
    {
      key: 'logger',
      expectedMessage: 'Cannot create deobfuscation queue without a logger',
    },
    {
      key: 'onSuccess',
      expectedMessage: 'Cannot create deobfuscation queue without a success callback function',
    },
    {
      key: 'onFail',
      expectedMessage: 'Cannot create deobfuscation queue without a failed callback function',
    },
  ]

  testCases.forEach(({ key, expectedMessage }) => {
    it(`returns a correct error message for an invalid ${key}`, () => {
      const validity = { ...base, [key]: false }
      const result = getValidationError(operationType, validity)
      expect(result).toBe(expectedMessage)
    })
  })

  it('correctly handles different operation types', () => {
    const differentOperationType = 'encryption'
    const validity = { ...base, label: false }
    const result = getValidationError(differentOperationType, validity)
    expect(result).toBe(`Cannot create ${differentOperationType} queue without a label`)
  })
})
