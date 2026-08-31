import { recover } from './recover'

interface GlobalWithGc {
  gc?: () => void
}

describe('recover', () => {
  beforeEach(() => {
    delete (globalThis as GlobalWithGc).gc
  })

  afterEach(() => {
    delete (globalThis as GlobalWithGc).gc
  })

  it('resolves after yielding when globalThis.gc is absent', async () => {
    await expect(recover()).resolves.toBeUndefined()
  })

  it('invokes globalThis.gc when present', async () => {
    const gcMock = jest.fn()
    ;(globalThis as GlobalWithGc).gc = gcMock
    await recover()
    expect(gcMock).toHaveBeenCalledTimes(1)
  })
})
