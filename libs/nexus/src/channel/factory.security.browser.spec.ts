import type { IAction } from '../types/action'
import type { IChannelConfig } from '../types/channel'
import type {
  SecurityChannelOptions,
  SecurityNegotiationRequest,
  SecurityProvider,
  SecurityTransport,
  SecurityWireChannel,
} from '../types/security'
import type { ChannelDependencies, ChannelSecurityDependencies } from './types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createChannel } from './factory'

describe('channel/factory security', () => {
  const contract = { accepted: [{ type: 'msg1' }], emitted: [{ type: 'msg1' }] }
  const acceptAction: IAction = { type: '[nexus] connection-request-accepted', senderId: 'test-broker-id', processId: 'process-1' }
  const openAction: IAction = { type: '[nexus] connection-opened', senderId: 'test-broker-id', processId: 'process-1' }

  let config: IChannelConfig
  let deps: ChannelDependencies
  let provider: SecurityProvider
  let security: ChannelSecurityDependencies
  let wireOptions: SecurityChannelOptions | null
  let operations: string[]

  const createMockTransport = (): SecurityTransport => ({
    send: jest.fn(() => {
      operations.push('transport.send')
    }),
    receive: jest.fn(),
    start: jest.fn(() => {
      operations.push('transport.start')
    }),
    stop: jest.fn(),
    resume: jest.fn(),
    dispose: jest.fn(),
    getProtocol: jest.fn(() => 'v4'),
  })

  const createWireChannel = (label: string): SecurityWireChannel => ({
    label,
    send: jest.fn(),
    receive: jest.fn(),
    stop: jest.fn(),
    resume: jest.fn(),
    hello: jest.fn(async () => new Uint8Array([1])),
    isHello: jest.fn(() => false),
    acceptHello: jest.fn(() => 'accepted'),
  })

  const receiveOpenedAction = (action: IAction): void => {
    wireOptions?.receive({
      origin: 'peer-1',
      target: 'local-1',
      data: { pid: 'pid-1', id: 'id-1', sequence: 1, message: action, schema: {}, schemaHash: '' },
    })
  }

  beforeEach(() => {
    wireOptions = null
    operations = []
    config = { name: 'test-channel', target: window, settings: { contract } }

    provider = {
      createChannel: jest.fn((label: string, options: SecurityChannelOptions) => {
        wireOptions = options
        return createWireChannel(label)
      }),
      protocolProvider: jest.fn(),
    }
    security = { localId: 'local-1', getProvider: jest.fn(() => provider), dispatch: jest.fn() }

    deps = {
      actions: {
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        denyConnection: jest.fn(),
        cancelConnection: jest.fn(),
        openConnection: jest.fn(),
        closeConnection: jest.fn(),
        destroyConnection: jest.fn(),
        newMessage: jest.fn((message) => ({ type: '[nexus] new-message', senderId: 'test-broker-id', data: message })),
        invalidRequest: jest.fn(),
      },
      processManager: { create: jest.fn(() => 'process-1'), remove: jest.fn() },
    }

    window.postMessage = jest.fn((message: unknown) => {
      operations.push(`post:${(message as IAction).type}`)
    })
  })

  describe('security methods', () => {
    it('stores and clears the pending security request', () => {
      const channel = createChannel(config, deps)
      const securityRequest: SecurityNegotiationRequest = { supported: ['v4', 'none'], preferred: 'v4' }
      const before = channel.getPendingSecurityRequest()

      channel.setPendingSecurityRequest(securityRequest)
      const during = channel.getPendingSecurityRequest()
      channel.setPendingSecurityRequest(null)

      expect([before, during, channel.getPendingSecurityRequest()]).toEqual([null, securityRequest, null])
    })

    it('stores the negotiated protocol', () => {
      const channel = createChannel(config, deps)
      const before = channel.getNegotiatedProtocol()

      channel.setNegotiatedProtocol('v4')

      expect([before, channel.getNegotiatedProtocol()]).toEqual([null, 'v4'])
    })

    it('stores and clears the security transport', () => {
      const channel = createChannel(config, deps)
      const transport = createMockTransport()
      const before = channel.getSecurityTransport()

      channel.setSecurityTransport(transport)
      const during = channel.getSecurityTransport()
      channel.setSecurityTransport(null)

      expect([before, during, channel.getSecurityTransport()]).toEqual([null, transport, null])
    })

    it('getSecuritySettings returns null when no security settings were provided', () => {
      const channel = createChannel(config, deps)

      expect(channel.getSecuritySettings()).toBeNull()
    })

    it('getSecuritySettings returns the configured security settings', () => {
      const channel = createChannel({ ...config, settings: { security: { protocol: 'v4', mode: 'fail-closed' } } }, deps)

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v4', mode: 'fail-closed' })
    })

    it('applySecuritySettings sets the settings on a channel created without any', () => {
      const channel = createChannel(config, deps)

      channel.applySecuritySettings({ protocol: 'v4', mode: 'fail-closed' })

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v4', mode: 'fail-closed' })
    })

    it('applySecuritySettings keeps the settings the channel was created with', () => {
      const channel = createChannel({ ...config, settings: { security: { protocol: 'v4' } } }, deps)

      channel.applySecuritySettings({ protocol: 'v3' })

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v4' })
    })

    it('getContractCompat returns null when no compatibility rule was provided', () => {
      const channel = createChannel(config, deps)

      expect(channel.getContractCompat()).toBeNull()
    })

    it('getContractCompat returns the configured compatibility rule', () => {
      const contractCompat = () => ({ compatible: true }) as const
      const channel = createChannel({ ...config, settings: { contractCompat } }, deps)

      expect(channel.getContractCompat()).toBe(contractCompat)
    })
  })

  describe('security transport', () => {
    it('attachSecurityTransport returns false without broker security dependencies', () => {
      const channel = createChannel(config, deps)

      expect(channel.attachSecurityTransport('v4', 'peer-1', 'initiator')).toBe(false)
    })

    it('attachSecurityTransport asks the broker for the provider of the negotiated protocol', () => {
      const channel = createChannel(config, { ...deps, security })

      channel.attachSecurityTransport('v3', 'peer-1', 'initiator')

      expect(security.getProvider).toHaveBeenCalledWith('v3')
    })

    it('attachSecurityTransport returns true when the broker provider serves the session', () => {
      const channel = createChannel(config, { ...deps, security })

      expect(channel.attachSecurityTransport('v4', 'peer-1', 'initiator')).toBe(true)
    })

    it('attachSecurityTransport opens the wire session between the broker id and the counterpart id', () => {
      const channel = createChannel(config, { ...deps, security })

      channel.attachSecurityTransport('v4', 'peer-1', 'responder')

      expect(provider.createChannel).toHaveBeenCalledWith(
        'test-channel',
        expect.objectContaining({ session: { protocol: 'v4', role: 'responder', localId: 'local-1', peerId: 'peer-1' } })
      )
    })

    it('attachSecurityTransport stores a transport for the negotiated protocol', () => {
      const channel = createChannel(config, { ...deps, security })

      channel.attachSecurityTransport('v4', 'peer-1', 'initiator')

      expect(channel.getSecurityTransport()?.getProtocol()).toBe('v4')
    })

    it('attachSecurityTransport disposes the transport it replaces', () => {
      const previous = createMockTransport()
      const channel = createChannel(config, { ...deps, security })
      channel.setSecurityTransport(previous)

      channel.attachSecurityTransport('v4', 'peer-1', 'initiator')

      expect(previous.dispose).toHaveBeenCalledTimes(1)
    })

    it('routes an opened action through the broker dispatch with the counterpart window as its source', () => {
      const action: IAction = { type: '[nexus] new-message', senderId: 'peer-1' }
      const channel = createChannel({ ...config, settings: { origin: 'https://example.com' } }, { ...deps, security })
      channel.attachSecurityTransport('v4', 'peer-1', 'initiator')

      receiveOpenedAction(action)

      expect(security.dispatch).toHaveBeenCalledWith({ data: action, origin: 'https://example.com', source: window })
    })

    it('fires security-ready once the counterpart confirms the session', () => {
      const handler = jest.fn()
      const channel = createChannel(config, { ...deps, security })
      channel.on('security-ready', handler)
      channel.attachSecurityTransport('v4', 'peer-1', 'initiator')

      receiveOpenedAction({ type: '[nexus] security-confirmed', senderId: 'peer-1' })

      expect(handler).toHaveBeenCalledWith({ protocol: 'v4' }, expect.objectContaining({ name: 'test-channel' }))
    })

    it('dropSecurityTransport disposes the attached transport', () => {
      const transport = createMockTransport()
      const channel = createChannel(config, deps)
      channel.setSecurityTransport(transport)

      channel.dropSecurityTransport()

      expect(transport.dispose).toHaveBeenCalledTimes(1)
    })

    it('dropSecurityTransport forgets the transport', () => {
      const channel = createChannel(config, deps)
      channel.setSecurityTransport(createMockTransport())

      channel.dropSecurityTransport()

      expect(channel.getSecurityTransport()).toBeNull()
    })

    it('dropSecurityTransport tolerates a channel without a transport', () => {
      const channel = createChannel(config, deps)

      expect(() => channel.dropSecurityTransport()).not.toThrow()
    })
  })

  describe('transport start', () => {
    it('beginResponse starts the transport after ACCEPT leaves', () => {
      const channel = createChannel(config, deps)
      channel.setSecurityTransport(createMockTransport())

      channel.beginResponse('sender-1', 'https://example.com', contract, 'process-1', acceptAction)

      expect(operations).toEqual(['post:[nexus] connection-request-accepted', 'transport.start'])
    })

    it('beginResponse answers in plaintext when no transport is attached', () => {
      const channel = createChannel(config, deps)

      channel.beginResponse('sender-1', 'https://example.com', contract, 'process-1', acceptAction)

      expect(operations).toEqual(['post:[nexus] connection-request-accepted'])
    })

    it('completeConnection starts the transport after OPEN leaves and the queue is flushed through it', () => {
      const channel = createChannel(config, deps)
      channel.setSecurityTransport(createMockTransport())
      channel.send('msg1', { seq: 1 })

      channel.completeConnection('https://example.com', contract, 'peer-1', openAction)

      expect(operations).toEqual(['post:[nexus] connection-opened', 'transport.send', 'transport.start'])
    })

    it('completeConnection opens in plaintext when no transport is attached', () => {
      const channel = createChannel(config, deps)
      channel.send('msg1', { seq: 1 })

      channel.completeConnection('https://example.com', contract, 'peer-1', openAction)

      expect(operations).toEqual(['post:[nexus] connection-opened', 'post:[nexus] new-message'])
    })
  })
})
