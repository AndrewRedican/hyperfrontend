import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { flavour } from './flavour'

describe('jest.doMock after jest.resetModules', () => {
  it('serves the replacement to a dynamic import made after it', async () => {
    expect(flavour()).toBe('vanilla')

    jest.resetModules()
    jest.doMock('./flavour', () => ({ flavour: () => 'chocolate' }))
    const fresh = await import('./flavour')

    expect(fresh.flavour()).toBe('chocolate')
    expect(flavour()).toBe('vanilla')
  })
})
