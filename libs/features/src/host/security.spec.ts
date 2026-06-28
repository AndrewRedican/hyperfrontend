import type { BrokerHandle } from '@hyperfrontend/nexus'
import { createProtocol as createV1Protocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createProtocol as createV2Protocol } from '@hyperfrontend/network-protocol/browser/v2'
import { registerSecurity } from './security'

jest.mock('@hyperfrontend/network-protocol/browser/v1', () => ({ createProtocol: jest.fn(() => 'v1-provider') }))
jest.mock('@hyperfrontend/network-protocol/browser/v2', () => ({ createProtocol: jest.fn(() => 'v2-provider') }))

function createMockBroker(): { broker: BrokerHandle; registerProtocol: jest.Mock } {
  const registerProtocol = jest.fn()
  return { broker: <BrokerHandle>(<unknown>{ registerProtocol, logger: { id: 'logger' } }), registerProtocol }
}

describe('registerSecurity', () => {
  it('registers the v1 provider built from the broker logger', () => {
    const { broker, registerProtocol } = createMockBroker()
    registerSecurity(broker, 'v1', undefined)
    expect(registerProtocol).toHaveBeenCalledWith('v1', 'v1-provider')
  })

  it('returns v1 channel settings', () => {
    expect(registerSecurity(createMockBroker().broker, 'v1', undefined)).toEqual({ security: { protocol: 'v1' } })
  })

  it('registers the v2 provider with the shared key', () => {
    registerSecurity(createMockBroker().broker, 'v2', 'secret')
    expect(createV2Protocol).toHaveBeenCalledWith({ id: 'logger' }, 'secret')
  })

  it('returns v2 channel settings carrying the shared key', () => {
    expect(registerSecurity(createMockBroker().broker, 'v2', 'secret')).toEqual({ security: { protocol: 'v2', sharedKey: 'secret' } })
  })

  it('defaults the v2 shared key to an empty string when omitted', () => {
    registerSecurity(createMockBroker().broker, 'v2', undefined)
    expect(createV2Protocol).toHaveBeenCalledWith({ id: 'logger' }, '')
  })

  it('passes the broker logger to the v1 provider factory', () => {
    registerSecurity(createMockBroker().broker, 'v1', undefined)
    expect(createV1Protocol).toHaveBeenCalledWith({ id: 'logger' })
  })

  it('registers nothing for the none protocol', () => {
    const { broker, registerProtocol } = createMockBroker()
    registerSecurity(broker, 'none', undefined)
    expect(registerProtocol).not.toHaveBeenCalled()
  })

  it('returns undefined settings for the none protocol', () => {
    expect(registerSecurity(createMockBroker().broker, undefined, undefined)).toBeUndefined()
  })
})
