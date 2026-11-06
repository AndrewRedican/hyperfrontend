import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { describeError, refusal } from './refusal'

describe('describeError', () => {
  it('reports a refusal by its message alone', () => {
    expect(describeError(refusal('no project named x'))).toBe('no project named x')
  })

  it('reports any other error by its stack', () => {
    const error = createError('broke')
    expect(describeError(error)).toBe(error.stack)
  })

  it('reports an error without a stack by its message', () => {
    const error = createError('broke')
    error.stack = undefined
    expect(describeError(error)).toBe('broke')
  })

  it('reports a thrown value that is no error as text', () => {
    expect(describeError(42)).toBe('42')
  })
})
