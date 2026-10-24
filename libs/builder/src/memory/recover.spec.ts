import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { recover } from './recover'

describe('recover', () => {
  beforeEach(() => {
    jest.stubGlobal('gc', undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('resolves after yielding when globalThis.gc is absent', async () => {
    await expect(recover()).resolves.toBeUndefined()
  })

  it('invokes globalThis.gc when present', async () => {
    const gcMock = jest.fn()
    jest.stubGlobal('gc', gcMock)
    await recover()
    expect(gcMock).toHaveBeenCalledTimes(1)
  })
})
