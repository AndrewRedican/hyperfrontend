import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { Mock } from '@hyperfrontend/testing'
import type { ShellOptions } from '../shared/types'
import type { MountResult } from './types'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

// note: Covers the handshake outcomes that never reach open: a deny and a counterpart cancel both end the mount early instead of waiting out the open timeout. The open timeout itself lives in lifecycle.timeout.spec.ts; the broader shell lifecycle in lifecycle.spec.ts.

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  destroy: Mock
  connect: Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const destroy = jest.fn()
  const connect = jest.fn()
  const channel = {
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: () => () => undefined,
    send: jest.fn(),
    disconnect: jest.fn(),
    destroy,
    connect,
  } as unknown as ChannelHandle
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    destroy,
    connect,
  }
}

const TARGET = { name: 'target' } as unknown as Window

function setup(config: { whenReady?: (begin: () => void) => () => void } = {}) {
  const mock = createMockChannel()
  const broker = { addChannel: jest.fn(() => mock.channel) } as unknown as BrokerHandle
  const cleanup = jest.fn()
  const mount = jest.fn((): MountResult => ({ target: TARGET, present: { mode: 'embedded' }, whenReady: config.whenReady, cleanup }))
  const monitor = { beat: jest.fn(), start: jest.fn(), stop: jest.fn(), setObservable: jest.fn(), getStatus: jest.fn() }
  const emitter = createEventEmitter()
  const events: unknown[] = []
  emitter.on('error', (data) => events.push({ event: 'error', data }))
  emitter.on('close', () => events.push({ event: 'close' }))
  const handle = createShellHandle(broker, { container: '#shell' } as ShellOptions, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor: jest.fn(() => monitor),
    observeVisibility: jest.fn(() => () => undefined),
  })
  const tornDown = () => ({ destroyed: mock.destroy.mock.calls.length, cleaned: cleanup.mock.calls.length })
  return { handle, mock, cleanup, monitor, events, tornDown }
}

const DENIAL = {
  error: 'Security is required for this channel but the counterpart cannot provide an encrypted protocol.',
  reason: 'security-unavailable',
}

describe('createShellHandle handshake termination', () => {
  describe('deny', () => {
    it('surfaces the deny payload as the error event', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('deny', DENIAL)
      expect(ctx.events).toEqual([{ event: 'error', data: DENIAL }])
    })

    it('tears the mount down', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('deny', DENIAL)
      expect(ctx.tornDown()).toEqual({ destroyed: 1, cleaned: 1 })
    })

    it('reports the error before the channel is destroyed', () => {
      const ctx = setup()
      let destroyedWhenReported: number | undefined
      ctx.handle.on('error', () => {
        destroyedWhenReported = ctx.mock.destroy.mock.calls.length
      })
      ctx.handle.open()
      ctx.mock.trigger('deny', DENIAL)
      expect(destroyedWhenReported).toBe(0)
    })

    it('stops the heartbeat monitor', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('deny', DENIAL)
      expect(ctx.monitor.stop).toHaveBeenCalledTimes(1)
    })

    it('leaves the shell closed', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('deny', DENIAL)
      expect(ctx.handle.isOpen).toBe(false)
    })

    it('does not emit close for a session that never opened', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('deny', DENIAL)
      expect(ctx.events).not.toContainEqual({ event: 'close' })
    })

    it('cancels a held handshake alongside the mount cleanup', () => {
      const cancel = jest.fn()
      const ctx = setup({ whenReady: () => cancel })
      ctx.handle.open()
      ctx.mock.trigger('deny', DENIAL)
      expect({ cancelled: cancel.mock.calls.length, connected: ctx.mock.connect.mock.calls.length }).toEqual({ cancelled: 1, connected: 0 })
    })

    it('rejects a request still waiting on the feature', async () => {
      const ctx = setup()
      ctx.handle.open()
      const pending = ctx.handle.request('getTime')
      ctx.mock.trigger('deny', DENIAL)
      await expect(pending).rejects.toThrow('The shell was destroyed before the feature responded.')
    })
  })

  describe('cancel', () => {
    it('emits a handshake-cancelled error when the feature cancels with notice', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: true })
      expect(ctx.events).toEqual([{ event: 'error', data: { reason: 'handshake-cancelled', displayMode: 'embedded' } }])
    })

    it('reports the active display mode in the cancelled error', () => {
      const ctx = setup()
      ctx.handle.open({ displayMode: 'dialog' })
      ctx.mock.trigger('cancel', { notify: true })
      expect(ctx.events).toEqual([{ event: 'error', data: { reason: 'handshake-cancelled', displayMode: 'dialog' } }])
    })

    it('tears the mount down when the feature cancels with notice', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: true })
      expect(ctx.tornDown()).toEqual({ destroyed: 1, cleaned: 1 })
    })

    it('destroys the channel before reporting the cancelled error', () => {
      const ctx = setup()
      let destroyedWhenReported: number | undefined
      ctx.handle.on('error', () => {
        destroyedWhenReported = ctx.mock.destroy.mock.calls.length
      })
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: true })
      expect(destroyedWhenReported).toBe(1)
    })

    it('stops the heartbeat monitor when the feature cancels with notice', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: true })
      expect(ctx.monitor.stop).toHaveBeenCalledTimes(1)
    })

    it('leaves the shell closed when the feature cancels with notice', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: true })
      expect(ctx.handle.isOpen).toBe(false)
    })

    it('rejects a request still waiting on the feature when the feature cancels with notice', async () => {
      const ctx = setup()
      ctx.handle.open()
      const pending = ctx.handle.request('getTime')
      ctx.mock.trigger('cancel', { notify: true })
      await expect(pending).rejects.toThrow('The shell was destroyed before the feature responded.')
    })

    it('ignores a cancel this side raised itself', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: false })
      expect({ ...ctx.tornDown(), events: ctx.events }).toEqual({ destroyed: 0, cleaned: 0, events: [] })
    })

    it('ignores a cancel with no payload', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel')
      expect({ ...ctx.tornDown(), events: ctx.events }).toEqual({ destroyed: 0, cleaned: 0, events: [] })
    })

    it('ignores a cancel whose notice flag is merely truthy', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: 'yes' })
      expect({ ...ctx.tornDown(), events: ctx.events }).toEqual({ destroyed: 0, cleaned: 0, events: [] })
    })

    it('keeps the monitor running when the cancel carries no notice', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('cancel', { notify: false })
      expect(ctx.monitor.stop).not.toHaveBeenCalled()
    })
  })
})
