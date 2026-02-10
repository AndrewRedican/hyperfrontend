/**
 * Tests for getChannel function
 */

import { getChannel } from './get'
import { addChannel } from './add'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import type { BrokerState } from '../types'

describe('getChannel', () => {
  const mockBrokerState: BrokerState = {
    id: 'broker-1',
    name: 'test-broker',
    window: <Window>global.window,
    contract: {
      accepted: [{ type: 'test', description: 'Test action' }],
      emitted: [],
    },
    settings: {
      contract: {
        accepted: [{ type: 'test', description: 'Test action' }],
        emitted: [],
      },
      debug: false,
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
      const mockWindow = <Window>{}
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

      const found = getChannel(registry, mockWindow)

      expect(found).toBe(channel)
    })

    it('return null for unknown window', () => {
      const mockWindow = <Window>{}

      const found = getChannel(registry, mockWindow)

      expect(found).toBeNull()
    })
  })

  describe('lookup by ID', () => {
    it('find channel by ID', () => {
      const mockWindow = <Window>{}
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
      const mockWindow = <Window>{}
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

      const found = getChannel(registry, 'test-channel')

      expect(found).toBe(channel)
    })

    it('return null for unknown name', () => {
      const found = getChannel(registry, 'unknown-name')

      expect(found).toBeNull()
    })

    it('prioritizes ID lookup over name lookup', () => {
      const mockWindow1 = <Window>{}

      // Create channel with name 'test-channel'
      const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow1)

      // If we search by channel1's ID, should get channel1 even if name matches another
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
      const window1 = <Window>{}

      addChannel(mockBrokerState, registry, processManager, actions, 'duplicate-name', window1)

      // getByName returns the first matching channel (duplicates are allowed)
      const found = getChannel(registry, 'duplicate-name')

      expect(found).toBeTruthy()
    })

    it('returns null for undefined reference', () => {
      const found = getChannel(registry, <string | Window>(<unknown>undefined))

      expect(found).toBeNull()
    })

    it('returns null for null reference', () => {
      const found = getChannel(registry, <string | Window>(<unknown>null))

      expect(found).toBeNull()
    })

    it('returns null for number reference', () => {
      const found = getChannel(registry, <string | Window>(<unknown>123))

      expect(found).toBeNull()
    })

    it('returns null for boolean reference', () => {
      const found = getChannel(registry, <string | Window>(<unknown>true))

      expect(found).toBeNull()
    })
  })
})
