/**
 * Unit Tests: NoneTransport
 *
 * Tests the passthrough transport implementation that performs no
 * encryption or obfuscation.
 */

import type { SecurityTransport } from '../../types/security'
import { createNoneTransport } from './none-transport'

describe('NoneTransport', () => {
  let mockTarget: { postMessage: jest.Mock }
  let transport: SecurityTransport & { handleReceive: (action: unknown) => void }

  beforeEach(() => {
    mockTarget = {
      postMessage: jest.fn(),
    }
    transport = createNoneTransport({ target: mockTarget as unknown as Window }) as SecurityTransport & {
      handleReceive: (action: unknown) => void
    }
  })

  describe('send', () => {
    it('passes through actions unchanged via postMessage', () => {
      const action = { type: 'TEST_ACTION', payload: { data: 123 } }

      transport.send(action)

      expect(mockTarget.postMessage).toHaveBeenCalledTimes(1)
      expect(mockTarget.postMessage).toHaveBeenCalledWith(action, '*')
    })

    it('uses custom origin when provided', () => {
      const customTransport = createNoneTransport({
        target: mockTarget as unknown as Window,
        origin: 'https://example.com',
      })
      const action = { type: 'TEST_ACTION' }

      customTransport.send(action)

      expect(mockTarget.postMessage).toHaveBeenCalledWith(action, 'https://example.com')
    })

    it('does not modify action object', () => {
      const originalAction = { type: 'TEST_ACTION', nested: { value: 'test' } }
      const actionCopy = JSON.parse(JSON.stringify(originalAction))

      transport.send(originalAction)

      expect(mockTarget.postMessage).toHaveBeenCalledWith(actionCopy, '*')
    })

    it('does not send when stopped', () => {
      transport.stop()
      transport.send({ type: 'TEST_ACTION' })

      expect(mockTarget.postMessage).not.toHaveBeenCalled()
    })

    it('resumes sending after resume', () => {
      transport.stop()
      transport.send({ type: 'TEST_ACTION_1' })
      transport.resume()
      transport.send({ type: 'TEST_ACTION_2' })

      expect(mockTarget.postMessage).toHaveBeenCalledTimes(1)
      expect(mockTarget.postMessage).toHaveBeenCalledWith({ type: 'TEST_ACTION_2' }, '*')
    })
  })

  describe('onReceive', () => {
    it('forwards received actions to handler', () => {
      const handler = jest.fn()
      const action = { type: 'RECEIVED_ACTION', data: 'test' }

      transport.onReceive(handler)
      transport.handleReceive(action)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(action)
    })

    it('does not forward when no handler is registered', () => {
      expect(() => {
        transport.handleReceive({ type: 'UNHANDLED' })
      }).not.toThrow()
    })

    it('replaces previous handler when called multiple times', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      const action = { type: 'TEST_ACTION' }

      transport.onReceive(handler1)
      transport.onReceive(handler2)
      transport.handleReceive(action)

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith(action)
    })

    it('does not deliver when stopped', () => {
      const handler = jest.fn()

      transport.onReceive(handler)
      transport.stop()
      transport.handleReceive({ type: 'TEST_ACTION' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('resumes delivery after resume', () => {
      const handler = jest.fn()

      transport.onReceive(handler)
      transport.stop()
      transport.handleReceive({ type: 'DROPPED' })
      transport.resume()
      transport.handleReceive({ type: 'DELIVERED' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ type: 'DELIVERED' })
    })
  })

  describe('isReady', () => {
    it('always reports ready', () => {
      expect(transport.isReady()).toBe(true)
    })

    it('remains ready after stop', () => {
      transport.stop()
      expect(transport.isReady()).toBe(true)
    })

    it('remains ready after resume', () => {
      transport.stop()
      transport.resume()
      expect(transport.isReady()).toBe(true)
    })
  })

  describe('getProtocol', () => {
    it('returns "none" protocol', () => {
      expect(transport.getProtocol()).toBe('none')
    })
  })

  describe('stop', () => {
    it('can be called multiple times without error', () => {
      expect(() => {
        transport.stop()
        transport.stop()
        transport.stop()
      }).not.toThrow()
    })
  })

  describe('resume', () => {
    it('can be called multiple times without error', () => {
      expect(() => {
        transport.resume()
        transport.resume()
        transport.resume()
      }).not.toThrow()
    })

    it('can be called without prior stop', () => {
      expect(() => {
        transport.resume()
      }).not.toThrow()
    })
  })

  describe('action types', () => {
    it('handles primitive action values', () => {
      transport.send('string-action')
      transport.send(123)
      transport.send(true)
      transport.send(null)

      expect(mockTarget.postMessage).toHaveBeenCalledWith('string-action', '*')
      expect(mockTarget.postMessage).toHaveBeenCalledWith(123, '*')
      expect(mockTarget.postMessage).toHaveBeenCalledWith(true, '*')
      expect(mockTarget.postMessage).toHaveBeenCalledWith(null, '*')
    })

    it('handles nested object actions', () => {
      const complexAction = {
        type: 'COMPLEX',
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
      }

      transport.send(complexAction)

      expect(mockTarget.postMessage).toHaveBeenCalledWith(complexAction, '*')
    })

    it('handles array actions', () => {
      const arrayAction = [{ type: 'A' }, { type: 'B' }]

      transport.send(arrayAction)

      expect(mockTarget.postMessage).toHaveBeenCalledWith(arrayAction, '*')
    })
  })
})
