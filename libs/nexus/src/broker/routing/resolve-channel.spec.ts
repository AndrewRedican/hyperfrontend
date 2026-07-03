import type { IAction } from '../../types/action'
import { createRegistry } from '../../core/registry/factory'
import { resolveChannel } from './resolve-channel'

describe('resolveChannel', () => {
  const sourceWindow = <Window>(<unknown>{ postMessage: jest.fn() })
  const otherWindow = <Window>(<unknown>{ postMessage: jest.fn() })

  function createEvent(senderId: string, source: Window | null): MessageEvent<IAction> {
    return <MessageEvent<IAction>>{
      data: <IAction>{ type: '[nexus] new-message', senderId },
      source,
    }
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

  it('falls back to sender id lookup when the event has no source', () => {
    const channel = { id: 'channel-1', name: 'to-remote', target: sourceWindow }
    registry.add(channel)

    expect(resolveChannel(registry, createEvent('channel-1', null))).toBe(channel)
  })

  it('falls back to sender id lookup when the source window is not registered', () => {
    const channel = { id: 'channel-1', name: 'to-remote', target: sourceWindow }
    registry.add(channel)

    expect(resolveChannel(registry, createEvent('channel-1', otherWindow))).toBe(channel)
  })

  it('returns undefined when neither the source window nor the sender id is registered', () => {
    expect(resolveChannel(registry, createEvent('unknown-sender', otherWindow))).toBeUndefined()
  })
})
