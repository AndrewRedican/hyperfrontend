import { broker, DEFAULT_CONTRACT } from './singleton'

describe('singleton (non-browser environment)', () => {
  it('imports without requiring a window', () => {
    expect(DEFAULT_CONTRACT).toBeDefined()
  })

  it('exposes the default broker export without creating it', () => {
    expect(broker).toBeDefined()
  })

  it('throws a descriptive error when the default broker is used without a window', () => {
    expect(() => broker.name).toThrow(
      'Cannot create broker: no window is available. Pass an explicit `window` in the broker config when running outside a browser environment.'
    )
  })
})
