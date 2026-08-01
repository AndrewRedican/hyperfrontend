import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { ShellOptions } from '../shared/types'
import type { MountContext, MountResult } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

// note: Experience-plugin wiring only; the rest of the shell handle behavior is covered by lifecycle.spec.ts and its siblings.

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  destroy: jest.Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const destroy = jest.fn()
  const channel = <ChannelHandle>(<unknown>{
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: () => () => undefined,
    send: jest.fn(),
    disconnect: jest.fn(),
    destroy,
    connect: jest.fn(),
  })
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    destroy,
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

function setup(config: { target?: Window | null; element?: HTMLElement } = {}) {
  const mock = createMockChannel()
  const broker = <BrokerHandle>(<unknown>{ addChannel: jest.fn(() => mock.channel) })
  const cleanup = jest.fn()
  let context: MountContext | undefined
  const mount = jest.fn((ctx: MountContext): MountResult => {
    context = ctx
    return {
      target: 'target' in config ? <Window | null>config.target : TARGET,
      element: config.element,
      present: { mode: 'embedded' },
      cleanup,
    }
  })
  const emitter = createEventEmitter()
  const handle = createShellHandle(broker, <ShellOptions>{ container: '#shell' }, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor: jest.fn(() => ({
      beat: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      setObservable: jest.fn(),
      getStatus: jest.fn(),
    })),
    observeVisibility: jest.fn(() => () => undefined),
  })
  return { handle, mock, cleanup, mount, getContext: () => context }
}

describe('createShellHandle', () => {
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
      ctx.mock.trigger('close', { notify: false })
      await flush()
      expect(onUnmount).toHaveBeenCalledTimes(1)
    })

    it('defers close-path cleanup until plugin onUnmount resolves', async () => {
      const { ctx } = openWithDeferredUnmount()
      ctx.mock.trigger('close', { notify: false })
      await flush()
      expect(ctx.cleanup).not.toHaveBeenCalled()
    })

    it('runs mount cleanup after the close-path teardown resolves', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.mock.trigger('close', { notify: false })
      deferred.resolve()
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })

    it('does not run cleanup twice when the channel closes during a destroy teardown', async () => {
      const { ctx, deferred } = openWithDeferredUnmount()
      ctx.handle.destroy()
      ctx.mock.trigger('close', { notify: false })
      deferred.resolve()
      await flush()
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })
  })
})
