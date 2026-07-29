import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { FeatureContract } from '../shared/types'
import { ControlType } from '../shared/control'
import { createEventEmitter } from '../shared/event-emitter'
import { installResizeObserverStub } from '../testing/resize-observer-stub'
import { createFeatureHandle } from './lifecycle'

jest.mock('@hyperfrontend/network-protocol/browser/v1', () => ({ createProtocol: jest.fn(() => 'v1-provider') }))
jest.mock('@hyperfrontend/network-protocol/browser/v2', () => ({ createProtocol: jest.fn(() => 'v2-provider') }))

beforeEach(() => {
  jest.clearAllMocks()
  installResizeObserverStub()
})

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  triggerMessage(type: string, data?: unknown): void
  send: jest.Mock
  disconnect: jest.Mock
  connect: jest.Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const messageHandlers: Array<(message: { type: string; data?: unknown }) => void> = []
  const send = jest.fn()
  const disconnect = jest.fn()
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
    connect,
  })
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
    send,
    disconnect,
    connect,
  }
}

function createMockBroker(channel: ChannelHandle): { broker: BrokerHandle; addChannel: jest.Mock } {
  const addChannel = jest.fn(() => channel)
  return { broker: <BrokerHandle>(<unknown>{ addChannel, registerProtocol: jest.fn(), logger: { id: 'logger' } }), addChannel }
}

describe('createFeatureHandle presentation', () => {
  const hostWindow = <Window>(<unknown>{ name: 'host' })
  const emptyContract: FeatureContract = { emitted: [], accepted: [] }

  function styleTexts(): string[] {
    return Array.from(document.head.querySelectorAll('style')).map((style) => style.textContent ?? '')
  }

  afterEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('emits presentation when the host announces the display mode', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('presentation', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'dialog' })
    expect(handler).toHaveBeenCalledWith({ mode: 'dialog' })
  })

  it('hides the present control message from consumer handlers', () => {
    const mock = createMockChannel()
    const handler = jest.fn()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
      contract: emptyContract,
    })
    handle.on(ControlType.Present, handler)
    mock.triggerMessage(ControlType.Present, { mode: 'dialog' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('reports no display mode before the announcement', () => {
    const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, hostWindow, createEventEmitter(), {
      contract: emptyContract,
    })
    expect(handle.displayMode).toBeNull()
  })

  it('reports the announced display mode', () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
      contract: emptyContract,
    })
    mock.triggerMessage(ControlType.Present, { mode: 'popup' })
    expect(handle.displayMode).toBe('popup')
  })

  it('reports no display mode after the channel closes', () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
      contract: emptyContract,
    })
    mock.triggerMessage(ControlType.Present, { mode: 'dialog' })
    mock.trigger('close')
    expect(handle.displayMode).toBeNull()
  })

  it('reports no display mode when unembedded', () => {
    const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter(), {
      contract: emptyContract,
    })
    expect(handle.displayMode).toBeNull()
  })

  it('emits presentation before the resize carried by the announcement', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const order: string[] = []
    emitter.on('presentation', () => order.push('presentation'))
    emitter.on('resize', () => order.push('resize'))
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'embedded', viewport: { width: 800, height: 600 } })
    expect(order).toEqual(['presentation', 'resize'])
  })

  it('emits resize with the exact announcement-carried viewport payload', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'embedded', viewport: { width: 412.5, height: 733.25 } })
    expect(handler).toHaveBeenCalledWith({ width: 412.5, height: 733.25 })
  })

  it('syncs the canvas from the announcement-carried viewport', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'embedded', viewport: { width: 800, height: 600 } })
    expect(styleTexts()).toContain('html,body{width:800px;height:600px}')
  })

  it('emits no resize when the announcement carries no viewport', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'embedded' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('emits resize with the exact host-reported viewport', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Viewport, { width: 412.5, height: 733.25 })
    expect(handler).toHaveBeenCalledWith({ width: 412.5, height: 733.25 })
  })

  it('applies the host-reported viewport to the document root', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.triggerMessage(ControlType.Viewport, { width: 640, height: 480 })
    expect(styleTexts()).toContain('html,body{width:640px;height:480px}')
  })

  it('emits resize from window resizes in popup mode', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'popup' })
    window.dispatchEvent(new Event('resize'))
    expect(handler).toHaveBeenCalledWith({ width: window.innerWidth, height: window.innerHeight })
  })

  it('emits resize from window resizes in standalone mode', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'standalone' })
    window.dispatchEvent(new Event('resize'))
    expect(handler).toHaveBeenCalledWith({ width: window.innerWidth, height: window.innerHeight })
  })

  it('starts a single window watcher across repeated windowed announcements', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'popup' })
    mock.triggerMessage(ControlType.Present, { mode: 'popup' })
    window.dispatchEvent(new Event('resize'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not watch window resizes in the iframe modes', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'embedded' })
    window.dispatchEvent(new Event('resize'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('sends a backdrop dismiss over the channel in dialog mode', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'dialog' })
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(mock.send).toHaveBeenCalledWith(ControlType.Dismiss, { source: 'backdrop' })
  })

  it('sends an escape dismiss over the channel in dialog mode', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'dialog' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(mock.send).toHaveBeenCalledWith(ControlType.Dismiss, { source: 'escape' })
  })

  it('removes the applied presentation styles when the channel closes', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'dialog' })
    mock.triggerMessage(ControlType.Viewport, { width: 640, height: 480 })
    mock.trigger('close')
    expect(styleTexts()).toEqual([])
  })

  it('stops sending dismiss signals after the channel closes', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'dialog' })
    mock.trigger('close')
    mock.send.mockClear()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(mock.send).not.toHaveBeenCalled()
  })

  it('stops the window watcher when the channel closes', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('resize', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage(ControlType.Present, { mode: 'popup' })
    mock.trigger('close')
    window.dispatchEvent(new Event('resize'))
    expect(handler).not.toHaveBeenCalled()
  })
})
