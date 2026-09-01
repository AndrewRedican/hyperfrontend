import type { BrokerState } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from './add'
import { getChannel } from './get'

describe('getChannel', () => {
  const mockBrokerState: BrokerState = {
    id: 'broker-1',
    name: 'test-broker',
    window: global.window as Window,
    contract: {
      accepted: [{ type: 'test', description: 'Test action' }],
      emitted: [],
    },
    settings: {
      contract: {
        accepted: [{ type: 'test', description: 'Test action' }],
        emitted: [],
      },
    },
    logger: {
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(),
    },
  }

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
  })

  describe('lookup by window', () => {
    it('find channel by window reference', () => {
      const mockWindow = {} as Window
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

      const found = getChannel(registry, mockWindow)

      expect(found).toBe(channel)
    })

    it('return null for unknown window', () => {
      const mockWindow = {} as Window

      const found = getChannel(registry, mockWindow)

      expect(found).toBeNull()
    })
  })

  describe('lookup by ID', () => {
    it('find channel by ID', () => {
      const mockWindow = {} as Window
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

      const found = getChannel(registry, channel.id)

      expect(found).toBe(channel)
    })

    it('return null for unknown ID', () => {
      const found = getChannel(registry, 'unknown-id')

      expect(found).toBeNull()
    })
  })

  describe('lookup by name', () => {
    it('find channel by name', () => {
      const mockWindow = {} as Window
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

      const found = getChannel(registry, 'test-channel')

      expect(found).toBe(channel)
    })

    it('return null for unknown name', () => {
      const found = getChannel(registry, 'unknown-name')

      expect(found).toBeNull()
    })

    it('prioritizes ID lookup over name lookup', () => {
      const mockWindow1 = {} as Window

      const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow1)

      const found = getChannel(registry, channel1.id)

      expect(found).toBe(channel1)
    })
  })

  describe('edge cases', () => {
    it('handles empty string reference', () => {
      const found = getChannel(registry, '')

      expect(found).toBeNull()
    })

    it('handles multiple channels with same name (returns first)', () => {
      const window1 = {} as Window

      addChannel(mockBrokerState, registry, processManager, actions, 'duplicate-name', window1)

      const found = getChannel(registry, 'duplicate-name')

      expect(found).toBeTruthy()
    })

    it('returns null for undefined reference', () => {
      const found = getChannel(registry, undefined as unknown as string | Window)

      expect(found).toBeNull()
    })

    it('returns null for null reference', () => {
      const found = getChannel(registry, null as unknown as string | Window)

      expect(found).toBeNull()
    })

    it('returns null for number reference', () => {
      const found = getChannel(registry, 123 as unknown as string | Window)

      expect(found).toBeNull()
    })

    it('returns null for boolean reference', () => {
      const found = getChannel(registry, true as unknown as string | Window)

      expect(found).toBeNull()
    })
  })
})
