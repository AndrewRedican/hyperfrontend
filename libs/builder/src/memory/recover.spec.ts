import { recover } from './recover'

interface GlobalWithGc {
  gc?: () => void
}

describe('recover', () => {
  beforeEach(() => {
    delete (<GlobalWithGc>globalThis).gc
  })

  afterEach(() => {
    delete (<GlobalWithGc>globalThis).gc
  })

  it('resolves after yielding when globalThis.gc is absent', async () => {
    await expect(recover()).resolves.toBeUndefined()
  })

  it('invokes globalThis.gc when present', async () => {
    const gcMock = jest.fn()
    ;(<GlobalWithGc>globalThis).gc = gcMock
    await recover()
    expect(gcMock).toHaveBeenCalledTimes(1)
  })
})
