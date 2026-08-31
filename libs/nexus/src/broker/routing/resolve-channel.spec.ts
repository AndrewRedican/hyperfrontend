import type { IAction } from '../../types/action'
import { createRegistry } from '../../core/registry/factory'
import { resolveChannel } from './resolve-channel'

describe('resolveChannel', () => {
  const sourceWindow = { postMessage: jest.fn() } as unknown as Window
  const otherWindow = { postMessage: jest.fn() } as unknown as Window

  function createEvent(senderId: string, source: Window | null, origin = 'http://remote.example'): MessageEvent<IAction> {
    return {
      data: { type: '[nexus] new-message', senderId } as IAction,
      source,
      origin,
    } as MessageEvent<IAction>
  }

  let registry: ReturnType<typeof createRegistry>

  beforeEach(() => {
    registry = createRegistry()
  })

  it('resolves the channel registered for the source window', () => {
    const channel = { id: 'channel-1', name: 'to-remote', target: sourceWindow }
    registry.add(channel)

    expect(resolveChannel(registry, createEvent('unknown-sender', sourceWindow))).toBe(channel)
  })

  it('returns undefined when the event has no source, ignoring the declared sender id', () => {
    registry.add({ id: 'channel-1', name: 'to-remote', target: sourceWindow })

    expect(resolveChannel(registry, createEvent('channel-1', null))).toBeUndefined()
  })

  it('returns undefined when the source window is not registered, ignoring the declared sender id', () => {
    registry.add({ id: 'channel-1', name: 'to-remote', target: sourceWindow })

    expect(resolveChannel(registry, createEvent('channel-1', otherWindow))).toBeUndefined()
  })

  it('returns undefined when the event origin does not match the pinned origin', () => {
    const channel = { id: 'channel-1', name: 'to-remote', target: sourceWindow, getOrigin: () => 'http://pinned.example' }
    registry.add(channel)

    expect(resolveChannel(registry, createEvent('channel-1', sourceWindow, 'http://evil.example'))).toBeUndefined()
  })

  it('resolves the channel when the event origin matches the pinned origin', () => {
    const channel = { id: 'channel-1', name: 'to-remote', target: sourceWindow, getOrigin: () => 'http://pinned.example' }
    registry.add(channel)

    expect(resolveChannel(registry, createEvent('channel-1', sourceWindow, 'http://pinned.example'))).toBe(channel)
  })

  it('resolves the channel from any origin when the pin is the wildcard', () => {
    const channel = { id: 'channel-1', name: 'to-remote', target: sourceWindow, getOrigin: () => '*' }
    registry.add(channel)

    expect(resolveChannel(registry, createEvent('channel-1', sourceWindow, 'http://anywhere.example'))).toBe(channel)
  })

  it('resolves the channel from any origin when no origin is pinned', () => {
    const channel = { id: 'channel-1', name: 'to-remote', target: sourceWindow, getOrigin: () => null }
    registry.add(channel)

    expect(resolveChannel(registry, createEvent('channel-1', sourceWindow))).toBe(channel)
  })
})
