import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
type WebSocketModule = typeof import('./index')

const originalWebSocket = globalThis.WebSocket

/** Stand-in constructor that records its arguments instead of opening a connection. */
class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  /** Arguments the factory handed to the constructor. */
  readonly args: unknown[]
  constructor(...args: unknown[]) {
    this.args = args
  }
}

const loadWith = async (constructor: unknown): Promise<WebSocketModule> => {
  jest.resetModules()
  if (constructor === undefined) {
    delete (globalThis as { WebSocket?: typeof WebSocket }).WebSocket
  } else {
    globalThis.WebSocket = constructor as typeof WebSocket
  }
  return import('./index')
}

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
})

describe('websocket without a WebSocket global', () => {
  it('imports without throwing', async () => {
    await expect(loadWith(undefined)).resolves.toBeDefined()
  })

  it('exposes the ready states the WebSocket standard fixes', async () => {
    const { CONNECTING, OPEN, CLOSING, CLOSED } = await loadWith(undefined)
    expect([CONNECTING, OPEN, CLOSING, CLOSED]).toEqual([0, 1, 2, 3])
  })

  it('throws a TypeError from createWebSocket', async () => {
    const { createWebSocket } = await loadWith(undefined)
    expect(() => createWebSocket('ws://localhost')).toThrow(new TypeError('WebSocket is not available in this environment'))
  })
})

describe('websocket with the WebSocket global present', () => {
  it('constructs through the captured constructor', async () => {
    const { createWebSocket } = await loadWith(FakeWebSocket)
    expect(createWebSocket('ws://localhost', 'chat')).toEqual(expect.objectContaining({ args: ['ws://localhost', 'chat'] }))
  })

  it('copies the ready states from the captured constructor', async () => {
    const { WebSocket: namespace } = await loadWith(FakeWebSocket)
    expect(namespace).toEqual(expect.objectContaining({ CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }))
  })
})
