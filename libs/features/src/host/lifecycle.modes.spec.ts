import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { Mock } from '@hyperfrontend/testing'
import type { DisplayMode, ShellOptions } from '../shared/types'
import type { DisplayModeMount, MountResult } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

// note: Display-mode selection only: a shell composed with a subset of the modes rejects the rest, which is what `createShell` builds from its `modes` map. The rest of the shell handle is covered by lifecycle.spec.ts and its siblings.

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  destroy: Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const destroy = jest.fn()
  const channel = {
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: () => () => undefined,
    send: jest.fn(),
    disconnect: jest.fn(),
    destroy,
    connect: jest.fn(),
  } as unknown as ChannelHandle
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    destroy,
  }
}

const TARGET = { name: 'target' } as unknown as Window

function setup() {
  const mock = createMockChannel()
  const broker = { addChannel: jest.fn(() => mock.channel) } as unknown as BrokerHandle
  const cleanup = jest.fn()
  const mount = jest.fn((): MountResult => ({ target: TARGET, present: { mode: 'embedded' }, cleanup }))
  const emitter = createEventEmitter()
  const handle = createShellHandle(broker, { container: '#shell' } as ShellOptions, emitter, {
    contract: { emitted: [], accepted: [] },
    // why: Mirrors the lookup `createShell` builds from its `modes` map, which throws for a mode the shell was not composed with.
    selectMount: (mode: DisplayMode): DisplayModeMount => {
      if (mode !== 'embedded') {
        throw createError(`This feature does not support the "${mode}" display mode; supported modes: embedded.`)
      }
      return mount
    },
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
  handle.open()
  mock.trigger('open')
  return { handle, mock, cleanup, mount }
}

describe('createShellHandle display-mode selection', () => {
  it('throws when opened in a mode the shell was not composed with', () => {
    expect(() => setup().handle.open({ displayMode: 'popup' })).toThrow('does not support the "popup" display mode')
  })

  it('keeps the running session open when the mode is rejected', () => {
    const ctx = setup()
    expect(() => ctx.handle.open({ displayMode: 'popup' })).toThrow()
    expect(ctx.handle.isOpen).toBe(true)
  })

  it('leaves the channel of the running session alive when the mode is rejected', () => {
    const ctx = setup()
    expect(() => ctx.handle.open({ displayMode: 'popup' })).toThrow()
    expect(ctx.mock.destroy).not.toHaveBeenCalled()
  })

  it('leaves the mount of the running session in place when the mode is rejected', () => {
    const ctx = setup()
    expect(() => ctx.handle.open({ displayMode: 'popup' })).toThrow()
    expect(ctx.cleanup).not.toHaveBeenCalled()
  })
})
