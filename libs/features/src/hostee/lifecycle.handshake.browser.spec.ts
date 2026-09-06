import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { Mock } from '@hyperfrontend/testing'
import type { FeatureContract } from '../shared/types'
import type { FeatureHandleSettings } from './lifecycle'
import type { FeatureHandle } from './types'
import { beforeEach } from 'node:test'
import { createPromise, promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createFeatureHandle } from './lifecycle'

// note: Intervals run their callback once and hand back their own delay, so the heartbeat and visibility reporters an open starts never leave a live timer behind.
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: jest.fn((callback: () => void, delay: number) => {
    callback()
    return delay
  }),
  clearInterval: jest.fn(),
  setTimeout: jest.fn(() => 1),
  clearTimeout: jest.fn(),
  requestAnimationFrame: jest.fn(() => 1),
  cancelAnimationFrame: jest.fn(),
}))

jest.mock('@hyperfrontend/network-protocol/browser/v3', () => ({ createProtocol: jest.fn(() => 'v3-provider') }))
// note: The key validator stays real so the v4 length gate is exercised; only the protocol factory is stubbed.
jest.mock('@hyperfrontend/network-protocol/browser/v4', () => ({
  ...jest.requireActual<object>('@hyperfrontend/network-protocol/browser/v4'),
  createProtocol: jest.fn(() => 'v4-provider'),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const channel = {
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: () => () => undefined,
    send: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
  } as unknown as ChannelHandle
  return { channel, trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)) }
}

function createMockBroker(channel: ChannelHandle): { broker: BrokerHandle; registerProtocol: Mock } {
  const registerProtocol = jest.fn()
  return {
    broker: { addChannel: jest.fn(() => channel), registerProtocol, logger: { id: 'logger' } } as unknown as BrokerHandle,
    registerProtocol,
  }
}

describe('createFeatureHandle handshake', () => {
  const hostWindow = { name: 'host' } as unknown as Window
  const emptyContract: FeatureContract = { emitted: [], accepted: [] }
  const sharedKey = 'a-key-of-sixteen-or-more'

  function createHandle(mock: MockChannel, settings: Omit<FeatureHandleSettings, 'contract'> = {}): FeatureHandle {
    return createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
      contract: emptyContract,
      ...settings,
    })
  }

  // note: Maps a ready() promise to its outcome so a rejection message is asserted exactly and several promises compare in one matcher.
  function outcome(ready: Promise<void>): Promise<string> {
    return ready.then(
      () => 'resolved',
      (error: Error) => error.message
    )
  }

  function flush(): Promise<void> {
    return createPromise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }

  describe('security selection', () => {
    it('registers the v3 provider pairing the wire pipeline with the protocol', () => {
      const mock = createMockChannel()
      const { broker, registerProtocol } = createMockBroker(mock.channel)
      createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract, protocol: 'v3' })
      expect(registerProtocol).toHaveBeenCalledWith('v3', { createChannel: expect.any(Function), protocolProvider: 'v3-provider' })
    })

    it('accepts a v4 shared key of exactly sixteen characters', () => {
      expect(() => createHandle(createMockChannel(), { protocol: 'v4', sharedKey: 'sixteen-chars-ok' })).not.toThrow()
    })

    it('throws when the v4 shared key is shorter than sixteen characters', () => {
      expect(() => createHandle(createMockChannel(), { protocol: 'v4', sharedKey: 'fifteen-chars-x' })).toThrow(
        'Security protocol \'v4\' requires a pre-shared key of at least 16 characters: set the "sharedKey" option.'
      )
    })

    it('throws when a shared key accompanies the v3 protocol', () => {
      expect(() => createHandle(createMockChannel(), { protocol: 'v3', sharedKey })).toThrow(
        "Security protocol 'v3' takes no pre-shared key; only 'v4' does. Remove the \"sharedKey\" option or select 'v4'."
      )
    })

    it('throws when a shared key accompanies an explicit none protocol', () => {
      expect(() => createHandle(createMockChannel(), { protocol: 'none', sharedKey })).toThrow(
        "Security protocol 'none' takes no pre-shared key; only 'v4' does. Remove the \"sharedKey\" option or select 'v4'."
      )
    })

    it('throws naming none when a shared key accompanies no protocol selection', () => {
      expect(() => createHandle(createMockChannel(), { sharedKey })).toThrow("Security protocol 'none' takes no pre-shared key")
    })
  })

  describe('deny', () => {
    it('rejects a pending ready() naming the reason and error the host gave', async () => {
      const mock = createMockChannel()
      const pending = outcome(createHandle(mock).ready())
      mock.trigger('deny', { reason: 'security-unavailable', error: 'The host requires the v4 protocol' })
      await expect(pending).resolves.toBe('The host refused the connection (security-unavailable): The host requires the v4 protocol.')
    })

    it('does not double the period when the host error already ends with one', async () => {
      const mock = createMockChannel()
      const pending = outcome(createHandle(mock).ready())
      mock.trigger('deny', { error: 'Invalid contract: missing emitted.' })
      await expect(pending).resolves.toBe('The host refused the connection: Invalid contract: missing emitted.')
    })

    it('rejects a pending ready() with a placeholder when the host gave a reason but no error text', async () => {
      const mock = createMockChannel()
      const pending = outcome(createHandle(mock).ready())
      mock.trigger('deny', { reason: 'policy-rejected' })
      await expect(pending).resolves.toBe('The host refused the connection (policy-rejected): no reason given.')
    })

    it('rejects a pending ready() without a reason clause when the host gave only error text', async () => {
      const mock = createMockChannel()
      const pending = outcome(createHandle(mock).ready())
      mock.trigger('deny', { error: 'The contract is missing a required action' })
      await expect(pending).resolves.toBe('The host refused the connection: The contract is missing a required action.')
    })

    it('rejects a pending ready() with the bare refusal when the host gave neither', async () => {
      const mock = createMockChannel()
      const pending = outcome(createHandle(mock).ready())
      mock.trigger('deny', {})
      await expect(pending).resolves.toBe('The host refused the connection: no reason given.')
    })

    it('rejects every pending ready() on one denial', async () => {
      const mock = createMockChannel()
      const handle = createHandle(mock)
      const outcomes = promiseAll([outcome(handle.ready()), outcome(handle.ready())])
      mock.trigger('deny', { error: 'The contract is missing a required action' })
      await expect(outcomes).resolves.toEqual([
        'The host refused the connection: The contract is missing a required action.',
        'The host refused the connection: The contract is missing a required action.',
      ])
    })

    it('rejects a ready() called after the denial already arrived', async () => {
      const mock = createMockChannel()
      const handle = createHandle(mock)
      mock.trigger('deny', { reason: 'security-unavailable', error: 'The host requires the v4 protocol.' })
      await expect(outcome(handle.ready())).resolves.toBe(
        'The host refused the connection (security-unavailable): The host requires the v4 protocol.'
      )
    })

    it('resolves a ready() called after an open that followed an earlier denial', async () => {
      const mock = createMockChannel()
      const handle = createHandle(mock)
      mock.trigger('deny', { error: 'The contract is missing a required action' })
      mock.trigger('open', {})
      await expect(handle.ready()).resolves.toBeUndefined()
    })

    it('leaves ready() resolving on an open channel after a stray denial', async () => {
      const mock = createMockChannel()
      const handle = createHandle(mock)
      mock.trigger('open')
      mock.trigger('deny', { error: 'The contract is missing a required action' })
      await expect(handle.ready()).resolves.toBeUndefined()
    })

    it('keeps a ready() awaited before the open resolved when a denial follows', async () => {
      const mock = createMockChannel()
      const pending = createHandle(mock).ready()
      mock.trigger('open')
      mock.trigger('deny', { error: 'The contract is missing a required action' })
      await expect(pending).resolves.toBeUndefined()
    })
  })

  describe('cancel', () => {
    it('rejects a pending ready() when the host cancelled with notice', async () => {
      const mock = createMockChannel()
      const pending = outcome(createHandle(mock).ready())
      mock.trigger('cancel', { notify: true })
      await expect(pending).resolves.toBe('The host cancelled the connection before it opened.')
    })

    it('rejects every pending ready() on one notified cancel', async () => {
      const mock = createMockChannel()
      const handle = createHandle(mock)
      const outcomes = promiseAll([outcome(handle.ready()), outcome(handle.ready())])
      mock.trigger('cancel', { notify: true })
      await expect(outcomes).resolves.toEqual([
        'The host cancelled the connection before it opened.',
        'The host cancelled the connection before it opened.',
      ])
    })

    it('leaves a pending ready() waiting when the cancel carried no notice', async () => {
      const mock = createMockChannel()
      const settled = jest.fn()
      void createHandle(mock).ready().then(settled, settled)
      mock.trigger('cancel', { notify: false })
      await flush()
      expect(settled).not.toHaveBeenCalled()
    })

    it('leaves a pending ready() waiting when the cancel carried no payload', async () => {
      const mock = createMockChannel()
      const settled = jest.fn()
      void createHandle(mock).ready().then(settled, settled)
      mock.trigger('cancel')
      await flush()
      expect(settled).not.toHaveBeenCalled()
    })

    it('still resolves a ready() kept waiting through an unnotified cancel once the host opens', async () => {
      const mock = createMockChannel()
      const pending = createHandle(mock).ready()
      mock.trigger('cancel', { notify: false })
      mock.trigger('open')
      await expect(pending).resolves.toBeUndefined()
    })

    it('leaves ready() resolving on an open channel after a stray notified cancel', async () => {
      const mock = createMockChannel()
      const handle = createHandle(mock)
      mock.trigger('open')
      mock.trigger('cancel', { notify: true })
      await expect(handle.ready()).resolves.toBeUndefined()
    })
  })
})
