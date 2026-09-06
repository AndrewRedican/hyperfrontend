import type { BrokerHandle } from '@hyperfrontend/nexus'
import type { Mock } from '@hyperfrontend/testing'
import { createProtocol as createV3Protocol } from '@hyperfrontend/network-protocol/browser/v3'
import { createProtocol as createV4Protocol } from '@hyperfrontend/network-protocol/browser/v4'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { registerSecurity } from './security'

jest.mock('@hyperfrontend/network-protocol/browser/v3', () => ({ createProtocol: jest.fn(() => 'v3-provider') }))
// why: The key validator stays real so the spec pins the published 16-character floor rather than a stub's idea of it.
jest.mock('@hyperfrontend/network-protocol/browser/v4', () => ({
  ...jest.requireActual<object>('@hyperfrontend/network-protocol/browser/v4'),
  createProtocol: jest.fn(() => 'v4-provider'),
}))

const KEY = 'a-key-of-sixteen-or-more'
const V4_KEY_MESSAGE = 'Security protocol \'v4\' requires a pre-shared key of at least 16 characters: set the "sharedKey" option.'
const strayKeyMessage = (protocol: string) =>
  `Security protocol '${protocol}' takes no pre-shared key; only 'v4' does. Remove the "sharedKey" option or select 'v4'.`

function createMockBroker(): { broker: BrokerHandle; registerProtocol: Mock } {
  const registerProtocol = jest.fn()
  return { broker: { registerProtocol, logger: { id: 'logger' } } as unknown as BrokerHandle, registerProtocol }
}

describe('registerSecurity', () => {
  describe('v4', () => {
    it('builds the v4 provider from the broker logger and the shared key', () => {
      registerSecurity(createMockBroker().broker, 'v4', KEY)
      expect(createV4Protocol).toHaveBeenCalledWith({ id: 'logger' }, KEY)
    })

    it('registers the v4 provider pairing the wire pipeline with the protocol', () => {
      const { broker, registerProtocol } = createMockBroker()
      registerSecurity(broker, 'v4', KEY)
      expect(registerProtocol).toHaveBeenCalledWith('v4', { createChannel: expect.any(Function), protocolProvider: 'v4-provider' })
    })

    it('returns fail-closed v4 channel settings', () => {
      expect(registerSecurity(createMockBroker().broker, 'v4', KEY)).toEqual({ security: { protocol: 'v4', mode: 'fail-closed' } })
    })

    it('accepts a key of exactly sixteen characters', () => {
      expect(registerSecurity(createMockBroker().broker, 'v4', 'sixteen-chars-ok')).toEqual({
        security: { protocol: 'v4', mode: 'fail-closed' },
      })
    })

    it('throws when the shared key is omitted', () => {
      expect(() => registerSecurity(createMockBroker().broker, 'v4', undefined)).toThrow(V4_KEY_MESSAGE)
    })

    it('throws when the shared key is shorter than sixteen characters', () => {
      expect(() => registerSecurity(createMockBroker().broker, 'v4', 'fifteen-chars-x')).toThrow(V4_KEY_MESSAGE)
    })

    it('throws when the shared key is an empty string', () => {
      expect(() => registerSecurity(createMockBroker().broker, 'v4', '')).toThrow(V4_KEY_MESSAGE)
    })

    it('registers nothing when the shared key is rejected', () => {
      const { broker, registerProtocol } = createMockBroker()
      expect(() => registerSecurity(broker, 'v4', 'short')).toThrow()
      expect(registerProtocol).not.toHaveBeenCalled()
    })

    it('never constructs the v4 provider from a rejected key', () => {
      expect(() => registerSecurity(createMockBroker().broker, 'v4', 'short')).toThrow()
      expect(createV4Protocol).not.toHaveBeenCalledWith(expect.anything(), 'short')
    })
  })

  describe('v3', () => {
    it('builds the v3 provider from the broker logger alone', () => {
      registerSecurity(createMockBroker().broker, 'v3', undefined)
      expect(createV3Protocol).toHaveBeenCalledWith({ id: 'logger' })
    })

    it('registers the v3 provider pairing the wire pipeline with the protocol', () => {
      const { broker, registerProtocol } = createMockBroker()
      registerSecurity(broker, 'v3', undefined)
      expect(registerProtocol).toHaveBeenCalledWith('v3', { createChannel: expect.any(Function), protocolProvider: 'v3-provider' })
    })

    it('returns fail-closed v3 channel settings', () => {
      expect(registerSecurity(createMockBroker().broker, 'v3', undefined)).toEqual({ security: { protocol: 'v3', mode: 'fail-closed' } })
    })

    it('throws when a shared key accompanies v3', () => {
      expect(() => registerSecurity(createMockBroker().broker, 'v3', KEY)).toThrow(strayKeyMessage('v3'))
    })

    it('rejects even an empty shared key alongside v3', () => {
      expect(() => registerSecurity(createMockBroker().broker, 'v3', '')).toThrow(strayKeyMessage('v3'))
    })

    it('registers nothing when a stray key is rejected', () => {
      const { broker, registerProtocol } = createMockBroker()
      expect(() => registerSecurity(broker, 'v3', KEY)).toThrow()
      expect(registerProtocol).not.toHaveBeenCalled()
    })
  })

  describe('none', () => {
    it('registers nothing for the none protocol', () => {
      const { broker, registerProtocol } = createMockBroker()
      registerSecurity(broker, 'none', undefined)
      expect(registerProtocol).not.toHaveBeenCalled()
    })

    it('returns undefined settings for the none protocol', () => {
      expect(registerSecurity(createMockBroker().broker, 'none', undefined)).toBeUndefined()
    })

    it('returns undefined settings when no protocol is selected', () => {
      expect(registerSecurity(createMockBroker().broker, undefined, undefined)).toBeUndefined()
    })

    it('registers nothing when no protocol is selected', () => {
      const { broker, registerProtocol } = createMockBroker()
      registerSecurity(broker, undefined, undefined)
      expect(registerProtocol).not.toHaveBeenCalled()
    })

    it('throws when a shared key accompanies the none protocol', () => {
      expect(() => registerSecurity(createMockBroker().broker, 'none', KEY)).toThrow(strayKeyMessage('none'))
    })

    it('names the none protocol when a shared key accompanies no selection', () => {
      expect(() => registerSecurity(createMockBroker().broker, undefined, KEY)).toThrow(strayKeyMessage('none'))
    })
  })
})
