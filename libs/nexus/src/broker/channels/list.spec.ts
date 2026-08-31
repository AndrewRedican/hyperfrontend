import type { BrokerState } from '../types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from './add'
import { listChannels } from './list'

describe('listChannels', () => {
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

  it('return empty array when no channels', () => {
    const channels = listChannels(registry)

    expect(channels).toEqual([])
  })

  it('return array of channel JSON representations', () => {
    const window1 = {} as Window
    const window2 = {} as Window

    addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', window1)
    addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)

    const channels = listChannels(registry)

    expect(channels).toHaveLength(2)
    expect(channels[0]).toHaveProperty('id')
    expect(channels[0]).toHaveProperty('name')
    expect(channels[1]).toHaveProperty('id')
    expect(channels[1]).toHaveProperty('name')
  })

  it('includes channel names in JSON', () => {
    const window1 = {} as Window

    addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', window1)

    const channels = listChannels(registry)

    expect(channels[0].name).toBe('test-channel')
  })

  it('return fresh array on each call', () => {
    const window1 = {} as Window
    addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', window1)

    const list1 = listChannels(registry)
    const list2 = listChannels(registry)

    expect(list1).not.toBe(list2)
    expect(list1).toEqual(list2)
  })

  it('updates when channels are added', () => {
    const window1 = {} as Window
    const window2 = {} as Window

    addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', window1)
    const list1 = listChannels(registry)

    addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const list2 = listChannels(registry)

    expect(list1).toHaveLength(1)
    expect(list2).toHaveLength(2)
  })
})
