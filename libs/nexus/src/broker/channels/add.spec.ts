import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { ChannelSecurityDependencies } from '../../channel/types'
import type { SecurityProvider, SecurityWireChannel } from '../../types/security'
import type { BrokerState } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from './add'

describe('addChannel', () => {
  const contract = { accepted: [{ type: 'test', description: 'Test action' }], emitted: [] }
  const brokerState: BrokerState = {
    id: 'broker-1',
    name: 'test-broker',
    window: {} as unknown as Window,
    contract,
    settings: { contract },
    logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger,
  }

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let target: Window
  let wireChannel: SecurityWireChannel
  let provider: SecurityProvider
  let security: ChannelSecurityDependencies

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({ getBrokerId: () => 'broker-1', getContract: () => contract })
    target = {} as unknown as Window
    wireChannel = {
      label: 'wire',
      send: jest.fn(),
      receive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      hello: jest.fn(async () => new Uint8Array([1])),
      isHello: jest.fn(() => false),
      acceptHello: jest.fn(() => 'accepted'),
    }
    provider = { createChannel: jest.fn(() => wireChannel), protocolProvider: jest.fn() }
    security = { localId: 'broker-1', getProvider: jest.fn(() => provider), dispatch: jest.fn() }
  })

  describe('registration', () => {
    it('creates a channel under the given name', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target)

      expect(channel.name).toBe('test-channel')
    })

    it('binds the channel to the target window', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target)

      expect(channel.target).toBe(target)
    })

    it('adds the channel to the registry', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target)

      expect(registry.getById(channel.id)).toBe(channel)
    })

    it('returns the existing channel when the window is already registered', () => {
      const first = addChannel(brokerState, registry, processManager, actions, 'channel-1', target)

      expect(addChannel(brokerState, registry, processManager, actions, 'channel-2', target)).toBe(first)
    })

    it('keeps one channel per window', () => {
      const first = addChannel(brokerState, registry, processManager, actions, 'channel-1', {} as Window)
      const second = addChannel(brokerState, registry, processManager, actions, 'channel-2', {} as Window)

      expect([first.name, second.name, first === second]).toEqual(['channel-1', 'channel-2', false])
    })

    it('removes the channel from the registry when it is destroyed', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target)

      channel.destroy(false)

      expect(registry.getById(channel.id)).toBeUndefined()
    })

    it('rejects settings that reference themselves', () => {
      const settings: Record<string, unknown> = {}
      settings['self'] = settings

      expect(() => addChannel(brokerState, registry, processManager, actions, 'test-channel', target, settings)).toThrow()
    })
  })

  describe('settings', () => {
    it('defaults to empty settings', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target)

      expect(channel.getSecuritySettings()).toBeNull()
    })

    it('passes the security settings to a new channel', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target, {
        security: { protocol: 'v4', mode: 'fail-closed' },
      })

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v4', mode: 'fail-closed' })
    })

    it('passes the contract-compatibility rule to a new channel', () => {
      const contractCompat = jest.fn(() => true)
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target, { contractCompat })

      expect(channel.getContractCompat()).toBe(contractCompat)
    })

    it('inherits the broker contract', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target)

      expect(channel.toJSON()).toEqual(expect.objectContaining({ contract }))
    })

    it('applies security settings to an existing channel that has none', () => {
      addChannel(brokerState, registry, processManager, actions, 'auto-created', target)

      const channel = addChannel(brokerState, registry, processManager, actions, 'app-channel', target, {
        security: { protocol: 'v4', mode: 'fail-closed' },
      })

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v4', mode: 'fail-closed' })
    })

    it('keeps the existing security settings when a later registration passes different ones', () => {
      addChannel(brokerState, registry, processManager, actions, 'app-channel', target, { security: { protocol: 'v4' } })

      const channel = addChannel(brokerState, registry, processManager, actions, 'late-channel', target, {
        security: { protocol: 'v3' },
      })

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v4' })
    })

    it('leaves an existing channel without security settings when the later registration passes none', () => {
      addChannel(brokerState, registry, processManager, actions, 'auto-created', target)

      const channel = addChannel(brokerState, registry, processManager, actions, 'app-channel', target, { timeout: 5000 })

      expect(channel.getSecuritySettings()).toBeNull()
    })
  })

  describe('security dependencies', () => {
    it('lets a channel attach a transport when the broker supplies them', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target, {}, security)

      expect(channel.attachSecurityTransport('v4', 'peer-1', 'initiator')).toBe(true)
    })

    it('resolves the provider through the broker lookup', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target, {}, security)

      channel.attachSecurityTransport('v3', 'peer-1', 'initiator')

      expect(security.getProvider).toHaveBeenCalledWith('v3')
    })

    it('runs the session between the broker id and the counterpart', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target, {}, security)

      channel.attachSecurityTransport('v4', 'peer-1', 'responder')

      expect(provider.createChannel).toHaveBeenCalledWith(
        'test-channel',
        expect.objectContaining({ session: { protocol: 'v4', role: 'responder', localId: 'broker-1', peerId: 'peer-1' } })
      )
    })

    it('leaves a channel unable to attach a transport when the broker supplies none', () => {
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target)

      expect(channel.attachSecurityTransport('v4', 'peer-1', 'initiator')).toBe(false)
    })

    it('leaves a channel unable to attach a transport for a protocol without a provider', () => {
      ;(security.getProvider as Mock).mockReturnValue(undefined)
      const channel = addChannel(brokerState, registry, processManager, actions, 'test-channel', target, {}, security)

      expect(channel.attachSecurityTransport('v4', 'peer-1', 'initiator')).toBe(false)
    })

    it('does not touch the dependencies at registration time', () => {
      addChannel(brokerState, registry, processManager, actions, 'test-channel', target, {}, security)

      expect(security.getProvider).not.toHaveBeenCalled()
    })
  })
})
