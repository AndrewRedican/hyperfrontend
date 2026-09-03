import type { BrokerState } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from './add'

describe('addChannel', () => {
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
  let mockWindow: Window

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
    mockWindow = {} as unknown as Window
  })

  it('creates and add new channel to registry', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    expect(channel).toBeDefined()
    expect(channel.name).toBe('test-channel')
  })

  it('return existing channel if window already registered', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', mockWindow)

    expect(channel2).toBe(channel1)
  })

  it('applies security settings to an existing channel that has none', () => {
    addChannel(mockBrokerState, registry, processManager, actions, 'auto-created', mockWindow)

    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'app-channel', mockWindow, {
      security: { protocol: 'v2', mode: 'fail-closed' },
    })

    expect(channel.getSecuritySettings()).toEqual({ protocol: 'v2', mode: 'fail-closed' })
  })

  it('keeps the existing security settings when a later registration passes different ones', () => {
    addChannel(mockBrokerState, registry, processManager, actions, 'app-channel', mockWindow, { security: { protocol: 'v2' } })

    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'late-channel', mockWindow, {
      security: { protocol: 'v1' },
    })

    expect(channel.getSecuritySettings()).toEqual({ protocol: 'v2' })
  })

  it('passs broker contract to new channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    expect(channel).toBeDefined()
  })

  it('passs debug setting to new channel', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        logLevel: 'debug',
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
    const window1 = {} as Window
    const window2 = {} as Window

    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', window1)
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)

    expect(channel1).not.toBe(channel2)
    expect(channel1.name).toBe('channel-1')
    expect(channel2.name).toBe('channel-2')
  })
})
