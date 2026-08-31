import type { IChannelContract } from '../types/contract'
import { createBroker } from './factory'

describe('createBroker (non-browser environment)', () => {
  const contract: IChannelContract = {
    emitted: [{ type: 'PING' }],
    accepted: [{ type: 'PONG' }],
  }

  it('throws a descriptive error when no window is available', () => {
    expect(() => createBroker({ name: 'test-broker', contract })).toThrow(
      'Cannot create broker: no window is available. Pass an explicit `window` in the broker config when running outside a browser environment.'
    )
  })

  it('registers its message listener on an explicitly provided window', () => {
    const mockWindow = {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
    } as unknown as Window

    createBroker({ name: 'test-broker', contract, window: mockWindow })

    expect(mockWindow.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('creates a working broker handle with an explicitly provided window', () => {
    const mockWindow = {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
    } as unknown as Window

    const broker = createBroker({ name: 'test-broker', contract, window: mockWindow })

    expect(broker.acceptedActionTypes).toEqual(['PONG'])
  })
})
