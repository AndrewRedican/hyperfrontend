/**
 * Tests for removeChannel function
 */

import type { BrokerState } from '../types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from './add'
import { getChannel } from './get'
import { removeChannel } from './remove'

describe('removeChannel', () => {
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

  it('removes channel from registry', () => {
    const mockWindow = <Window>{}
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    removeChannel(registry, channel)

    const found = getChannel(registry, channel.id)
    expect(found).toBeNull()
  })

  it('destroy channel before removing', () => {
    const mockWindow = <Window>{}
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    const destroySpy = jest.spyOn(channel, 'destroy')

    removeChannel(registry, channel)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('removes channel by window lookup', () => {
    const mockWindow = <Window>{}
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    removeChannel(registry, channel)

    const found = getChannel(registry, mockWindow)
    expect(found).toBeNull()
  })

  it('removes channel by name lookup', () => {
    const mockWindow = <Window>{}
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    removeChannel(registry, channel)

    const found = getChannel(registry, 'test-channel')
    expect(found).toBeNull()
  })

  it('does not affect other channels', () => {
    const window1 = <Window>{}
    const window2 = <Window>{}

    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', window1)
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)

    removeChannel(registry, channel1)

    const found = getChannel(registry, channel2.id)
    expect(found).toBe(channel2)
  })

  it('handles removing already removed channel gracefully', () => {
    const mockWindow = <Window>{}
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    removeChannel(registry, channel)

    // Should not throw when removing again
    expect(() => removeChannel(registry, channel)).not.toThrow()
  })
})
