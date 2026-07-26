import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { ShellOptions } from '../shared/types'
import type { MountContext, MountResult } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  triggerMessage(type: string, data?: unknown): void
  send: jest.Mock
  disconnect: jest.Mock
  destroy: jest.Mock
  connect: jest.Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const messageHandlers: Array<(message: { type: string; data?: unknown }) => void> = []
  const send = jest.fn()
  const disconnect = jest.fn()
  const destroy = jest.fn()
  const connect = jest.fn()
  const channel = <ChannelHandle>(<unknown>{
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: (handler: (message: { type: string; data?: unknown }) => void) => {
      messageHandlers.push(handler)
      return () => undefined
    },
    send,
    disconnect,
    destroy,
    connect,
  })
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
    send,
    disconnect,
    destroy,
    connect,
  }
}

const TARGET = <Window>(<unknown>{ name: 'target' })

function createDeferred() {
  const settle: { resolve(): void; reject(reason: unknown): void } = { resolve: () => undefined, reject: () => undefined }
  const promise = createPromise<void>((resolve, reject) => {
    settle.resolve = () => resolve()
    settle.reject = reject
  })
  return { promise, ...settle }
}

function flush() {
  return createPromise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function setup(config: { target?: Window | null; settings?: Record<string, unknown>; frame?: HTMLElement; element?: HTMLElement } = {}) {
  const mock = createMockChannel()
  const addChannel = jest.fn(() => mock.channel)
  const broker = <BrokerHandle>(<unknown>{ addChannel })
  const cleanup = jest.fn()
  let context: MountContext | undefined
  const mount = jest.fn((ctx: MountContext): MountResult => {
    context = ctx
    return { target: 'target' in config ? <Window | null>config.target : TARGET, element: config.element, frame: config.frame, cleanup }
  })
  const selectMount = jest.fn(() => mount)
  const registerSecurity = jest.fn(() => config.settings)
  const monitor = { beat: jest.fn(), start: jest.fn(), stop: jest.fn() }
  let unresponsive: ((missedBeats: number, lastBeatAt: number | null) => void) | undefined
  const createHeartbeatMonitor = jest.fn((onUnresponsive: (m: number, l: number | null) => void) => {
    unresponsive = onUnresponsive
    return monitor
  })
  const emitter = createEventEmitter()
  const base = <ShellOptions>{ container: '#shell' }
  const handle = createShellHandle(broker, base, emitter, { selectMount, registerSecurity, createHeartbeatMonitor })
  return {
    handle,
    mock,
    addChannel,
    cleanup,
    mount,
    selectMount,
    registerSecurity,
    monitor,
    emitter,
    getContext: () => context,
    triggerUnresponsive: (missedBeats: number, lastBeatAt: number | null) => unresponsive?.(missedBeats, lastBeatAt),
  }
}

describe('createShellHandle', () => {
  it('reports closed before any open', () => {
    expect(setup().handle.isOpen).toBe(false)
  })

  it('defaults to the embedded display mode', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(ctx.selectMount).toHaveBeenCalledWith('embedded')
  })

  it('selects the requested display mode', () => {
    const ctx = setup()
    ctx.handle.open({ displayMode: 'dialog' })
    expect(ctx.selectMount).toHaveBeenCalledWith('dialog')
  })

  it('merges create-time and per-open options for the mount', () => {
    const ctx = setup()
    ctx.handle.open({ url: 'https://feature.example' })
    expect(ctx.getContext()?.options).toEqual(expect.objectContaining({ container: '#shell', url: 'https://feature.example' }))
  })

  it('adds a channel against the mounted target', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(ctx.addChannel).toHaveBeenCalledWith('feature-1', TARGET, { contractCompat: expect.any(Function) })
  })

  it('passes registered security settings to the channel', () => {
    const ctx = setup({ settings: { security: { protocol: 'v2' } } })
    ctx.handle.open({ protocol: 'v2' })
    expect(ctx.addChannel).toHaveBeenCalledWith('feature-1', TARGET, expect.objectContaining({ security: { protocol: 'v2' } }))
  })

  it('connects the channel after mounting', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(ctx.mock.connect).toHaveBeenCalledTimes(1)
  })

  it('marks the shell open when the channel opens', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    expect(ctx.handle.isOpen).toBe(true)
  })

  it('emits open when the channel opens', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('open', handler)
    ctx.handle.open()
    ctx.mock.trigger('open')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emits close when the channel closes', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('close', handler)
    ctx.handle.open()
    ctx.mock.trigger('close')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('runs mount cleanup when the channel closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('close')
    expect(ctx.cleanup).toHaveBeenCalledTimes(1)
  })

  it('marks the shell closed when the channel closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.trigger('close')
    expect(ctx.handle.isOpen).toBe(false)
  })

  it('emits error when the channel denies the connection', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.mock.trigger('deny', { reason: 'origin' })
    expect(handler).toHaveBeenCalledWith({ reason: 'origin' })
  })

  it('emits error when the channel reports an invalid message', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.mock.trigger('invalid', { reason: 'schema' })
    expect(handler).toHaveBeenCalledWith({ reason: 'schema' })
  })

  it('re-emits feature messages keyed by action type', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('timeUpdated', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('timeUpdated', { time: 1 })
    expect(handler).toHaveBeenCalledWith({ time: 1 })
  })

  it('emits error when the mounted window is blocked', () => {
    const ctx = setup({ target: null })
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    expect(handler).toHaveBeenCalledWith(expect.any(Error))
  })

  it('does not add a channel when the mounted window is blocked', () => {
    const ctx = setup({ target: null })
    ctx.handle.open()
    expect(ctx.addChannel).not.toHaveBeenCalled()
  })

  it('sends messages through the channel', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.send('setTimezone', { tz: 'UTC' })
    expect(ctx.mock.send).toHaveBeenCalledWith('setTimezone', { tz: 'UTC' })
  })

  it('treats send as a no-op before opening', () => {
    expect(() => setup().handle.send('noop')).not.toThrow()
  })

  it('disconnects the channel on close', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.close()
    expect(ctx.mock.disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not destroy the channel on a graceful close', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.close()
    expect(ctx.mock.destroy).not.toHaveBeenCalled()
  })

  it('cleans up directly when closing a blocked open', () => {
    const ctx = setup({ target: null })
    ctx.handle.open()
    ctx.handle.close()
    expect(ctx.cleanup).toHaveBeenCalledTimes(1)
  })

  it('is a no-op to close before opening', () => {
    expect(() => setup().handle.close()).not.toThrow()
  })

  it('destroys the channel on destroy', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.destroy()
    expect(ctx.mock.destroy).toHaveBeenCalledTimes(1)
  })

  it('runs mount cleanup on destroy', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.destroy()
    expect(ctx.cleanup).toHaveBeenCalledTimes(1)
  })

  it('requests a graceful close from the mount close callback', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.getContext()?.requestClose()
    expect(ctx.mock.disconnect).toHaveBeenCalledTimes(1)
  })

  it('tears down the prior channel when reopened', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.open()
    expect(ctx.mock.destroy).toHaveBeenCalledTimes(1)
  })

  it('increments the channel name on reopen', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.open()
    expect(ctx.addChannel).toHaveBeenLastCalledWith('feature-2', TARGET, { contractCompat: expect.any(Function) })
  })

  it('starts the heartbeat monitor when the channel opens', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    expect(ctx.monitor.start).toHaveBeenCalledTimes(1)
  })

  it('feeds received beats to the monitor', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:beat')
    expect(ctx.monitor.beat).toHaveBeenCalledTimes(1)
  })

  it('hides control beats from consumer handlers', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('__hf:beat', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:beat')
    expect(handler).not.toHaveBeenCalled()
  })

  it('swallows non-beat control messages without feeding the monitor', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:size', { height: 100 })
    expect(ctx.monitor.beat).not.toHaveBeenCalled()
  })

  it('applies an announced content size to the frame in content mode', () => {
    const frame = <HTMLElement>(<unknown>{ style: {} })
    const ctx = setup({ frame })
    ctx.handle.open({ embedSizing: 'content' })
    ctx.mock.triggerMessage('__hf:size', { height: 360 })
    expect(frame.style.height).toBe('360px')
  })

  it('ignores announced size when the mount exposes no frame', () => {
    const ctx = setup()
    ctx.handle.open({ embedSizing: 'content' })
    expect(() => ctx.mock.triggerMessage('__hf:size', { height: 360 })).not.toThrow()
  })

  it('ignores announced size in fill mode', () => {
    const frame = <HTMLElement>(<unknown>{ style: {} })
    const ctx = setup({ frame })
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:size', { height: 360 })
    expect(frame.style.height).toBeUndefined()
  })

  it('stops the monitor when the channel closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('close')
    expect(ctx.monitor.stop).toHaveBeenCalledTimes(1)
  })

  it('stops the monitor on destroy', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.destroy()
    expect(ctx.monitor.stop).toHaveBeenCalledTimes(1)
  })

  it('emits error when the feature becomes unresponsive by default', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.triggerUnresponsive(3, null)
    expect(handler).toHaveBeenCalledWith(expect.any(Error))
  })

  it('tears the feature down when onUnresponsive is unmount', () => {
    const ctx = setup()
    ctx.handle.open({ onUnresponsive: 'unmount' })
    ctx.triggerUnresponsive(3, null)
    expect(ctx.mock.destroy).toHaveBeenCalledTimes(1)
  })

  it('invokes the onUnresponsive callback with the failure context', () => {
    const ctx = setup()
    const onUnresponsive = jest.fn()
    ctx.handle.open({ onUnresponsive })
    ctx.triggerUnresponsive(2, 123)
    expect(onUnresponsive).toHaveBeenCalledWith(expect.objectContaining({ missedBeats: 2, lastBeatAt: 123, displayMode: 'embedded' }))
  })

  it('reports the active display mode in the unresponsive context', () => {
    const ctx = setup()
    const onUnresponsive = jest.fn()
    ctx.handle.open({ displayMode: 'dialog', onUnresponsive })
    ctx.triggerUnresponsive(1, null)
    expect(onUnresponsive).toHaveBeenCalledWith(expect.objectContaining({ displayMode: 'dialog' }))
  })

  it('does not emit error when a callback handles the unresponsive feature', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open({ onUnresponsive: jest.fn() })
    ctx.triggerUnresponsive(2, 123)
    expect(handler).not.toHaveBeenCalled()
  })

  describe('experience plugins', () => {
    const track = (calls: string[], name: string) => () => {
      calls.push(name)
    }

    const failingMount = () => {
      throw createError('mount failed')
    }

    const failingTeardown = () => () => {
      throw createError('teardown failed')
    }

    function openWithDeferredUnmount() {
      const deferred = createDeferred()
      const ctx = setup()
      ctx.handle.open({ plugins: [{ name: 'exit', onUnmount: () => deferred.promise }] })
      return { ctx, deferred }
    }

    it('invokes onMount with the mounted element and display mode', () => {
      const element = <HTMLElement>(<unknown>{ tagName: 'IFRAME' })
      const ctx = setup({ element })
      const onMount = jest.fn()
      ctx.handle.open({ plugins: [{ name: 'fade', onMount }] })
      expect(onMount).toHaveBeenCalledWith({ element, displayMode: 'embedded' })
    })

    it('passes a null element when the mount exposes none', () => {
      const ctx = setup()
      const onMount = jest.fn()
      ctx.handle.open({ plugins: [{ name: 'fade', onMount }] })
      expect(onMount).toHaveBeenCalledWith({ element: null, displayMode: 'embedded' })
    })

    it('hands plugins the active display mode', () => {
      const ctx = setup()
      const onMount = jest.fn()
      ctx.handle.open({ displayMode: 'dialog', plugins: [{ name: 'fade', onMount }] })
      expect(onMount).toHaveBeenCalledWith(expect.objectContaining({ displayMode: 'dialog' }))
    })

    it('mounts plugins in registration order', () => {
      const calls: string[] = []
      const ctx = setup()
      ctx.handle.open({
        plugins: [
          { name: 'a', onMount: track(calls, 'a') },
          { name: 'b', onMount: track(calls, 'b') },
        ],
      })
      expect(calls).toEqual(['a', 'b'])
    })

    it('skips plugins without an onMount hook', () => {
      const ctx = setup()
      const onMount = jest.fn()
      ctx.handle.open({ plugins: [{ name: 'silent' }, { name: 'fade', onMount }] })
      expect(onMount).toHaveBeenCalledTimes(1)
    })

    it('emits error when a plugin onMount throws', () => {
      const ctx = setup()
      const handler = jest.fn()
      ctx.handle.on('error', handler)
      ctx.handle.open({ plugins: [{ name: 'bad', onMount: failingMount }] })
      expect(handler).toHaveBeenCalledWith(expect.any(Error))
    })

    it('mounts the remaining plugins after one onMount throws', () => {
      const ctx = setup()
      const onMount = jest.fn()
      ctx.handle.open({
        plugins: [
          { name: 'bad', onMount: failingMount },
          { name: 'ok', onMount },
        ],
      })
      expect(onMount).toHaveBeenCalledTimes(1)
    })

    it('does not mount plugins when the feature window is blocked', () => {
      const ctx = setup({ target: null })
      const onMount = jest.fn()
      ctx.handle.open({ plugins: [{ name: 'fade', onMount }] })
      expect(onMount).not.toHaveBeenCalled()
    })

    it('keeps destroy synchronous with an empty plugin list', () => {
      const ctx = setup()
      ctx.handle.open({ plugins: [] })
      ctx.handle.destroy()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })

    it('invokes onUnmount with the plugin context on destroy', async () => {
      const element = <HTMLElement>(<unknown>{ tagName: 'IFRAME' })
      const ctx = setup({ element })
      const onUnmount = jest.fn()
      ctx.handle.open({ plugins: [{ name: 'exit', onUnmount }] })
      ctx.handle.destroy()
      await flush()
      expect(onUnmount).toHaveBeenCalledWith({ element, displayMode: 'embedded' })
    })

    it('invokes onUnmount hooks in reverse registration order', async () => {
      const calls: string[] = []
      const ctx = setup()
      ctx.handle.open({
        plugins: [
          { name: 'a', onUnmount: track(calls, 'a') },
          { name: 'b', onUnmount: track(calls, 'b') },
        ],
      })
      ctx.handle.destroy()
      await flush()
      expect(calls).toEqual(['b', 'a'])
    })

    it('runs onMount teardowns after onUnmount settles in reverse registration order', async () => {
      const calls: string[] = []
      const ctx = setup()
      ctx.handle.open({
        plugins: [
          { name: 'a', onMount: () => track(calls, 'a-teardown') },
          { name: 'b', onMount: () => track(calls, 'b-teardown'), onUnmount: track(calls, 'b-unmount') },
        ],
      })
      ctx.handle.destroy()
      await flush()
      expect(calls).toEqual(['b-unmount', 'b-teardown', 'a-teardown'])
    })

    it('defers mount cleanup until onUnmount resolves', async () => {
      const { ctx } = openWithDeferredUnmount()
      ctx.handle.destroy()
      await flush()
      expect(ctx.cleanup).not.toHaveBeenCalled()
    })

    it('runs mount cleanup after onUnmount resolves', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.destroy()
      deferred.resolve()
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })

    it('keeps the channel alive while onUnmount is pending', async () => {
      const { ctx } = openWithDeferredUnmount()
      ctx.handle.destroy()
      await flush()
      expect(ctx.mock.destroy).not.toHaveBeenCalled()
    })

    it('destroys the channel after onUnmount resolves', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.destroy()
      deferred.resolve()
      await flush()
      expect(ctx.mock.destroy).toHaveBeenCalledTimes(1)
    })

    it('emits error when a plugin onUnmount rejects', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      const handler = jest.fn()
      ctx.handle.on('error', handler)
      ctx.handle.destroy()
      deferred.reject('exit animation failed')
      await flush()
      expect(handler).toHaveBeenCalledWith('exit animation failed')
    })

    it('continues teardown after a rejected onUnmount', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.destroy()
      deferred.reject('exit animation failed')
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })

    it('runs the remaining onUnmount hooks after one rejects', async () => {
      const deferred = createDeferred()
      const ctx = setup()
      const onUnmount = jest.fn()
      ctx.handle.open({
        plugins: [
          { name: 'a', onUnmount },
          { name: 'b', onUnmount: () => deferred.promise },
        ],
      })
      ctx.handle.destroy()
      deferred.reject('exit animation failed')
      await flush()
      expect(onUnmount).toHaveBeenCalledTimes(1)
    })

    it('emits error when an onMount teardown throws', async () => {
      const ctx = setup()
      const handler = jest.fn()
      ctx.handle.on('error', handler)
      ctx.handle.open({ plugins: [{ name: 'bad', onMount: failingTeardown }] })
      ctx.handle.destroy()
      await flush()
      expect(handler).toHaveBeenCalledWith(expect.any(Error))
    })

    it('finishes cleanup after an onMount teardown throws', async () => {
      const ctx = setup()
      ctx.handle.open({ plugins: [{ name: 'bad', onMount: failingTeardown }] })
      ctx.handle.destroy()
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })

    it('defers a reopen while plugin teardown is in flight', () => {
      const { ctx } = openWithDeferredUnmount()
      ctx.handle.open()
      expect(ctx.mount).toHaveBeenCalledTimes(1)
    })

    it('remounts after the in-flight plugin teardown resolves', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.open()
      deferred.resolve()
      await flush()
      expect(ctx.mount).toHaveBeenCalledTimes(2)
    })

    it('applies only the last open queued during plugin teardown', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.open({ url: 'https://first.example' })
      ctx.handle.open({ url: 'https://last.example' })
      deferred.resolve()
      await flush()
      expect(ctx.getContext()?.options).toEqual(expect.objectContaining({ url: 'https://last.example' }))
    })

    it('ignores a second destroy while plugin teardown is in flight', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.destroy()
      ctx.handle.destroy()
      deferred.resolve()
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })

    it('cancels a queued reopen when destroy is called during teardown', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.open()
      ctx.handle.destroy()
      deferred.resolve()
      await flush()
      expect(ctx.mount).toHaveBeenCalledTimes(1)
    })

    it('runs plugin onUnmount when the channel closes', async () => {
      const ctx = setup()
      const onUnmount = jest.fn()
      ctx.handle.open({ plugins: [{ name: 'exit', onUnmount }] })
      ctx.mock.trigger('close')
      await flush()
      expect(onUnmount).toHaveBeenCalledTimes(1)
    })

    it('defers close-path cleanup until plugin onUnmount resolves', async () => {
      const { ctx } = openWithDeferredUnmount()
      ctx.mock.trigger('close')
      await flush()
      expect(ctx.cleanup).not.toHaveBeenCalled()
    })

    it('runs mount cleanup after the close-path teardown resolves', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.mock.trigger('close')
      deferred.resolve()
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })

    it('does not run cleanup twice when the channel closes during a destroy teardown', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.destroy()
      ctx.mock.trigger('close')
      deferred.resolve()
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })
  })
})
