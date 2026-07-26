import type { SecurityProvider, SecurityTransportConfig } from '../../types/security'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol as createV1Protocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createProtocol as createV2Protocol } from '@hyperfrontend/network-protocol/browser/v2'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createSecurityTransport } from './factory'

describe('Security Transport Factory', () => {
  const createV1Provider = (): SecurityProvider => ({
    createChannel,
    protocolProvider: createV1Protocol(logger, 1),
  })

  const createV2Provider = (): SecurityProvider => ({
    createChannel,
    protocolProvider: createV2Protocol(logger, 'factory-spec-shared-key', 1),
  })

  const createConfig = (overrides: Partial<SecurityTransportConfig> = {}): SecurityTransportConfig => ({
    protocol: 'none',
    label: 'factory-spec',
    target: <Window>(<unknown>{ postMessage: jest.fn() }),
    getOrigin: () => null,
    originId: uuidV4(),
    targetId: uuidV4(),
    onAction: jest.fn(),
    ...overrides,
  })

  describe('none protocol', () => {
    it('creates a passthrough transport reporting the none protocol', () => {
      const transport = createSecurityTransport(createConfig())

      expect(transport.getProtocol()).toBe('none')
    })

    it('is ready without any provider', () => {
      const transport = createSecurityTransport(createConfig())

      expect(transport.isReady()).toBe(true)
    })

    it('ignores a supplied provider', () => {
      const postMessage = jest.fn()
      const transport = createSecurityTransport(
        createConfig({
          provider: createV2Provider(),
          target: <Window>(<unknown>{ postMessage }),
        })
      )

      transport.send({ type: 'TEST' })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST' }, '*')
    })

    it('posts to the pinned origin', () => {
      const postMessage = jest.fn()
      const transport = createSecurityTransport(
        createConfig({
          target: <Window>(<unknown>{ postMessage }),
          getOrigin: () => 'https://custom.example.com',
        })
      )

      transport.send({ type: 'TEST' })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST' }, 'https://custom.example.com')
    })
  })

  describe('v1 protocol', () => {
    it('creates a secure transport reporting the v1 protocol', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'v1', provider: createV1Provider() }))

      expect(transport.getProtocol()).toBe('v1')
    })

    it('is ready from construction', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'v1', provider: createV1Provider() }))

      expect(transport.isReady()).toBe(true)
    })

    it('throws when the provider is missing', () => {
      expect(() => createSecurityTransport(createConfig({ protocol: 'v1' }))).toThrow("Security protocol 'v1' requires a protocol provider")
    })
  })

  describe('v2 protocol', () => {
    it('creates a secure transport reporting the v2 protocol', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'v2', provider: createV2Provider() }))

      expect(transport.getProtocol()).toBe('v2')
    })

    it('is ready from construction', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'v2', provider: createV2Provider() }))

      expect(transport.isReady()).toBe(true)
    })

    it('throws when the provider is missing', () => {
      expect(() => createSecurityTransport(createConfig({ protocol: 'v2' }))).toThrow("Security protocol 'v2' requires a protocol provider")
    })
  })

  describe('external protocols', () => {
    it('creates a secure transport for a custom protocol identifier', () => {
      const transport = createSecurityTransport(createConfig({ protocol: 'acme-x25519', provider: createV2Provider() }))

      expect(transport.getProtocol()).toBe('acme-x25519')
    })

    it('throws when a custom protocol has no provider', () => {
      expect(() => createSecurityTransport(createConfig({ protocol: 'acme-x25519' }))).toThrow(
        "Security protocol 'acme-x25519' requires a protocol provider"
      )
    })
  })
})
