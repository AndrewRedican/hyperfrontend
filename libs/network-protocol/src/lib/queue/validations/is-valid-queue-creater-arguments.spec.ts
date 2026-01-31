/* eslint-disable @typescript-eslint/no-explicit-any */
import { isValidQueueCreaterArguments } from './is-valid-queue-creater-arguments'

describe('isValidQueueCreaterArguments', () => {
  const validArgs: any = {
    label: 'label',
    operation: () => void 0,
    logger: {
      debug: () => void 0,
      info: () => void 0,
      log: () => void 0,
      warn: () => void 0,
      error: () => void 0,
      setLogLevel: () => void 0,
      getLogLevel: () => void 0,
    },
    onSuccess: () => void 0,
    onFail: () => void 0,
  }

  it('returns true for all valid arguments', () => {
    const result = isValidQueueCreaterArguments(validArgs)
    expect(result).toEqual({
      label: true,
      operation: true,
      logger: true,
      onSuccess: true,
      onFail: true,
    })
  })

  it('returns false for invalid label', () => {
    const args = { ...validArgs, label: 123 }
    const result = isValidQueueCreaterArguments(args)
    expect(result.label).toBe(false)
  })

  it('returns false for invalid operation', () => {
    const args = { ...validArgs, operation: 'notAFunction' }
    const result = isValidQueueCreaterArguments(args)
    expect(result.operation).toBe(false)
  })

  it('returns false for invalid logger', () => {
    const args = { ...validArgs, logger: 'notAValidLogger' }
    const result = isValidQueueCreaterArguments(args)
    expect(result.logger).toBe(false)
  })

  it('returns false for invalid onSuccess', () => {
    const args = { ...validArgs, onSuccess: 'notAFunction' }
    const result = isValidQueueCreaterArguments(args)
    expect(result.onSuccess).toBe(false)
  })

  it('returns false for invalid onFail', () => {
    const args = { ...validArgs, onFail: 'notAFunction' }
    const result = isValidQueueCreaterArguments(args)
    expect(result.onFail).toBe(false)
  })
})
