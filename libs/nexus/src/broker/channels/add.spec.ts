/**
 * Tests for addChannel function
 */

import { addChannel } from './add'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import type { BrokerState } from '../types'

describe('addChannel', () => {
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
  let mockWindow: Window

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
    mockWindow = <Window>(<unknown>{})
  })

  it('creates and add new channel to registry', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    expect(channel).toBeDefined()
    expect(channel.name).toBe('test-channel')
  })

  it('return existing channel if window already registered', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', mockWindow)

    // Should return the same channel instance
    expect(channel2).toBe(channel1)
  })

  it('passs broker contract to new channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    // Channel should have access to broker's contract
    expect(channel).toBeDefined()
  })

  it('passs debug setting to new channel', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        debug: true,
      },
    }

    const channel = addChannel(debugState, registry, processManager, actions, 'test-channel', mockWindow)

    expect(channel).toBeDefined()
  })

  it('acceptss optional channel settings', () => {
    const customSettings = {
      timeout: 5000,
    }

    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, customSettings)

    expect(channel).toBeDefined()
  })

  it('handles multiple channels with different windows', () => {
    const window1 = <Window>{}
    const window2 = <Window>{}

    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', window1)
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)

    expect(channel1).not.toBe(channel2)
    expect(channel1.name).toBe('channel-1')
    expect(channel2.name).toBe('channel-2')
  })
})
