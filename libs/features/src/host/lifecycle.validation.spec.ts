import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { FeatureContract, ShellOptions } from '../shared/types'
import type { MountResult } from './types'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

// note: Covers the per-action payload validation around send and subscriber dispatch; the broader shell lifecycle lives in lifecycle.spec.ts.

// note: Host-oriented combined contract — emitted is what the host sends; the schemas exercise both validation directions.
const HOST_CONTRACT: FeatureContract = {
  emitted: [
    { type: 'setTimezone', schema: { type: 'object', properties: { tz: { type: 'string' } }, required: ['tz'] } },
    { type: 'reset' },
  ],
  accepted: [{ type: 'timeUpdated', schema: { type: 'object', properties: { time: { type: 'number' } }, required: ['time'] } }],
}

interface MockChannel {
  channel: ChannelHandle
  triggerMessage(type: string, data?: unknown): void
  send: jest.Mock
}

function createMockChannel(): MockChannel {
  const messageHandlers: Array<(message: { type: string; data?: unknown }) => void> = []
  const send = jest.fn()
  const channel = <ChannelHandle>(<unknown>{
    on: () => () => undefined,
    onMessage: (handler: (message: { type: string; data?: unknown }) => void) => {
      messageHandlers.push(handler)
      return () => undefined
    },
    send,
    disconnect: jest.fn(),
    destroy: jest.fn(),
    connect: jest.fn(),
  })
  return {
    channel,
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
    send,
  }
}

const TARGET = <Window>(<unknown>{ name: 'target' })

function setup() {
  const mock = createMockChannel()
  const broker = <BrokerHandle>(<unknown>{ addChannel: jest.fn(() => mock.channel) })
  const mount = jest.fn((): MountResult => ({ target: TARGET, cleanup: jest.fn() }))
  const emitter = createEventEmitter()
  const handle = createShellHandle(broker, <ShellOptions>{ container: '#shell' }, emitter, {
    contract: HOST_CONTRACT,
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor: jest.fn(() => ({ beat: jest.fn(), start: jest.fn(), stop: jest.fn() })),
  })
  return { handle, mock, emitter }
}

describe('createShellHandle payload validation', () => {
  it('throws in the host frame when a send payload violates the emitted schema', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(() => ctx.handle.send('setTimezone', {})).toThrow("Invalid payload for action 'setTimezone'")
  })

  it('keeps a schema-violating payload off the channel', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(() => ctx.handle.send('setTimezone', {})).toThrow()
    expect(ctx.mock.send).not.toHaveBeenCalled()
  })

  it('sends a schema-valid payload through the channel', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.send('setTimezone', { tz: 'UTC' })
    expect(ctx.mock.send).toHaveBeenCalledWith('setTimezone', { tz: 'UTC' })
  })

  it('sends a schema-less action payload through unchanged', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.send('reset', { anything: true })
    expect(ctx.mock.send).toHaveBeenCalledWith('reset', { anything: true })
  })

  it('drops an incoming payload that violates the accepted schema', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('timeUpdated', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('timeUpdated', { time: 'not-a-number' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('surfaces a dropped incoming payload as an invalid-payload error', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('timeUpdated', {})
    expect(handler).toHaveBeenCalledWith({
      reason: 'invalid-payload',
      type: 'timeUpdated',
      errors: [expect.objectContaining({ message: 'Missing required property: time' })],
    })
  })

  it('delivers a schema-valid incoming payload to subscribers', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('timeUpdated', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('timeUpdated', { time: 1 })
    expect(handler).toHaveBeenCalledWith({ time: 1 })
  })

  it('leaves request envelopes outside payload validation', async () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.handle.handle('getHostInfo', () => 'ready')
    ctx.mock.triggerMessage('__hf:request', { correlationId: 'feature-1', from: 'feature', innerType: 'getHostInfo' })
    await createPromise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    expect({ errors: handler.mock.calls, responded: ctx.mock.send.mock.calls }).toEqual({
      errors: [],
      responded: [['__hf:response', expect.objectContaining({ ok: true, payload: 'ready' })]],
    })
  })
})
