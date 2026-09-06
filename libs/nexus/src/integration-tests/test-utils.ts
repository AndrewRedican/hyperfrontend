import type { Mock } from '@hyperfrontend/testing'
import type { BrokerHandle } from '../broker/types'
import type { IAction } from '../types/action'
import type { ChannelHandle, IChannelSettings } from '../types/channel'
import type { IChannelContract } from '../types/contract'
import type { ChannelEvent } from '../types/events'
import type { SecurityProtocolProviders, SecurityProvider } from '../types/security'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol as createV3Protocol } from '@hyperfrontend/network-protocol/browser/v3'
import { createProtocol as createV4Protocol } from '@hyperfrontend/network-protocol/browser/v4'
import { jest } from '@hyperfrontend/testing'
import { createBroker } from '../broker/factory'

/**
 * Type representing a message listener function
 */
type MessageListener = (event: MessageEvent) => void

/**
 * Mock window interface for testing
 */
export interface MockWindow extends Partial<Window> {
  /** Mock postMessage function */
  postMessage: Mock
  /** Mock addEventListener function */
  addEventListener: Mock
  /** Mock removeEventListener function */
  removeEventListener: Mock
  /** Internal: Get all registered message listeners */
  _getMessageListeners: () => MessageListener[]
  /** Internal: Dispatch a message event to all listeners */
  _dispatchMessage: (event: MessageEvent) => void
}

/**
 * Creates a mock window object that simulates postMessage behavior.
 *
 * The mock tracks message listeners and allows simulating message delivery
 * between windows for integration testing.
 *
 * @returns A mock window object with jest mock functions
 *
 * @example Linking mock windows for bidirectional communication
 * ```typescript
 * const windowA = createMockWindow()
 * const windowB = createMockWindow()
 *
 * // Link them for bidirectional communication
 * linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
 * ```
 */
export function createMockWindow(): MockWindow {
  const listeners: MessageListener[] = []

  const mockWindow: MockWindow = {
    postMessage: jest.fn(),

    addEventListener: jest.fn((type: string, listener: MessageListener) => {
      if (type === 'message') {
        listeners.push(listener)
      }
    }),

    removeEventListener: jest.fn((type: string, listener: MessageListener) => {
      if (type === 'message') {
        const index = listeners.indexOf(listener)
        if (index !== -1) {
          listeners.splice(index, 1)
        }
      }
    }),

    _getMessageListeners: () => [...listeners],

    _dispatchMessage: (event: MessageEvent) => {
      listeners.forEach((listener) => listener(event))
    },
  }

  return mockWindow
}

/**
 * Links two mock windows for bidirectional communication.
 *
 * Mirrors real browser postMessage semantics: calling `postMessage` on a
 * window dispatches the event to that window's own listeners, with `source`
 * set to the counterpart window and `origin` set to the counterpart's origin.
 *
 * @param windowA - First mock window
 * @param windowB - Second mock window
 * @param originA - Origin URL for window A (e.g., 'http://host-a.com')
 * @param originB - Origin URL for window B (e.g., 'http://host-b.com')
 *
 * Delivery is synchronous so tests stay deterministic regardless of the
 * jest timer mode in use.
 *
 * @example Setting up bidirectional window communication
 * ```typescript
 * const windowA = createMockWindow()
 * const windowB = createMockWindow()
 * linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
 * // code running in windowA sends to windowB:
 * // windowB.postMessage(data) -> windowB listeners get { data, source: windowA, origin: originA }
 * ```
 */
export function linkMockWindows(windowA: MockWindow, windowB: MockWindow, originA: string, originB: string): void {
  windowA.postMessage.mockImplementation((data: unknown) => {
    windowA._dispatchMessage(
      new MessageEvent('message', {
        data,
        origin: originB,
        source: windowB as unknown as Window,
      })
    )
  })

  windowB.postMessage.mockImplementation((data: unknown) => {
    windowB._dispatchMessage(
      new MessageEvent('message', {
        data,
        origin: originA,
        source: windowA as unknown as Window,
      })
    )
  })
}

/**
 * Simulates a message being sent to a window.
 *
 * Creates a MessageEvent and dispatches it to all registered message listeners
 * on the target window. The payload may be a plaintext action or a wire frame.
 *
 * @param targetWindow - The mock window to receive the message
 * @param message - The action or wire frame to deliver
 * @param origin - The origin URL of the sender
 * @param source - Optional source window reference
 *
 * @example Dispatching a message to a mock window
 * ```typescript
 * simulateMessage(mockWindow, { type: 'PING' }, 'http://origin.com')
 * ```
 */
export function simulateMessage(targetWindow: MockWindow, message: IAction | Uint8Array, origin: string, source?: MockWindow): void {
  const event = new MessageEvent('message', {
    data: message,
    origin,
    source: (source as unknown as Window) || null,
  })
  targetWindow._dispatchMessage(event)
}

/**
 * Creates a MessageEvent for testing without dispatching it.
 *
 * Useful when you need to test handler functions directly.
 *
 * @param data - The action/message data
 * @param origin - The origin URL
 * @param source - Optional source window
 * @returns A MessageEvent object
 *
 * @example Creating an event for direct handler testing
 * ```typescript
 * const event = createMessageEvent({ type: 'PING' }, 'http://origin.com')
 * handler(event)
 * ```
 */
export function createMessageEvent<T = IAction>(data: T, origin: string, source?: MockWindow): MessageEvent<T> {
  return new MessageEvent<T>('message', {
    data,
    origin,
    source: (source as unknown as Window) || null,
  })
}

/**
 * Waits for a specified number of milliseconds.
 *
 * Useful for waiting for async message delivery in tests.
 *
 * @param ms - Number of milliseconds to wait
 * @returns A promise that resolves after the specified time
 *
 * @example Waiting for async message delivery
 * ```typescript
 * await wait(100)
 * // 100ms have passed
 * ```
 */
export function wait(ms: number): Promise<void> {
  return createPromise((resolve) => setTimeout(resolve, ms))
}

/**
 * Polls a condition on the real clock until it holds.
 *
 * The secure session's hello exchange and sealing run through WebCrypto, so
 * the suites that drive real providers cannot advance a fake clock past
 * them; they wait for the observable outcome instead.
 *
 * @param condition - Predicate evaluated on every poll
 * @param timeoutMs - How long to keep polling before giving up
 * @returns A promise that resolves once the condition holds
 * @throws {Error} When the condition does not hold within the timeout
 *
 * @example Waiting for both sides to confirm the session
 * ```typescript
 * await waitFor(() => readyA.length === 1 && readyB.length === 1)
 * ```
 */
export async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  // magic: 20ms keeps the poll far below the shortest deadline the suites configure (300ms) while staying cheap.
  const intervalMs = 20
  for (let elapsed = 0; elapsed <= timeoutMs; elapsed += intervalMs) {
    if (condition()) {
      return
    }
    await wait(intervalMs)
  }
  throw createError(`Timed out after ${timeoutMs}ms waiting for condition`)
}

/**
 * Flushes all pending timers and promises.
 *
 * Call this after operations that use setTimeout to ensure all
 * async operations complete.
 *
 * @example Flushing pending timers after postMessage
 * ```typescript
 * windowA.postMessage({ type: 'PING' })
 * await flushAsync()
 * // All async callbacks have completed
 * ```
 */
export async function flushAsync(): Promise<void> {
  await wait(0)
  jest.runAllTimers()
  await wait(0)
}

/**
 * Creates a test contract for integration tests.
 *
 * @param emitted - Array of message types this side emits
 * @param accepted - Array of message types this side accepts
 * @returns A channel contract object
 *
 * @example Creating a contract with emitted and accepted message types
 * ```typescript
 * const contract = createTestContract(['PING'], ['PONG'])
 * // => { emitted: [{ type: 'PING' }], accepted: [{ type: 'PONG' }] }
 * ```
 */
export function createTestContract(emitted: string[] = [], accepted: string[] = []) {
  return {
    emitted: emitted.map((type) => ({ type })),
    accepted: accepted.map((type) => ({ type })),
  }
}

/**
 * Creates a pair of complementary contracts.
 *
 * What side A emits, side B accepts and vice versa.
 *
 * @param aEmits - Message types that side A emits (B accepts)
 * @param bEmits - Message types that side B emits (A accepts)
 * @returns Object with contractA and contractB
 *
 * @example Creating complementary contracts for two sides
 * ```typescript
 * const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
 * // contractA emits PING, accepts PONG
 * // contractB emits PONG, accepts PING
 * ```
 */
export function createContractPair(aEmits: string[] = [], bEmits: string[] = []) {
  return {
    contractA: createTestContract(aEmits, bEmits),
    contractB: createTestContract(bEmits, aEmits),
  }
}

/**
 * Creates a real v3 security provider: ephemeral session keys, no shared secret.
 *
 * @returns A provider backed by network-protocol's browser v3 protocol
 *
 * @example Registering v3 on a broker
 * ```typescript
 * createBroker({ name, contract, window, settings: { security: { protocols: { v3: createV3Provider() } } } })
 * ```
 */
export function createV3Provider(): SecurityProvider {
  return { createChannel, protocolProvider: createV3Protocol(logger) }
}

/**
 * Creates a real v4 security provider: ephemeral session keys bound to a shared key.
 *
 * @param sharedKey - The pre-shared key, at least 16 characters
 * @returns A provider backed by network-protocol's browser v4 protocol
 *
 * @example Registering v4 on a broker
 * ```typescript
 * createBroker({ name, contract, window, settings: { security: { protocols: { v4: createV4Provider(sharedKey) } } } })
 * ```
 */
export function createV4Provider(sharedKey: string): SecurityProvider {
  return { createChannel, protocolProvider: createV4Protocol(logger, sharedKey) }
}

/**
 * What one side of a paired handshake is built from.
 */
export interface PartyConfig {
  /** Broker name */
  name: string
  /** Contract the broker speaks */
  contract: IChannelContract
  /** Window the broker listens on */
  window: MockWindow
  /** Counterpart window the channel targets */
  counterpart: MockWindow
  /** Channel name (defaults to 'to-peer') */
  channelName?: string
  /** Security providers registered on the broker */
  providers?: SecurityProtocolProviders
  /** Settings applied to the channel */
  channelSettings?: Partial<IChannelSettings>
}

/**
 * One side of a paired handshake: a broker listening on its own window and
 * the channel it holds towards the counterpart window.
 */
export interface Party {
  /** The broker listening on the party's window */
  broker: BrokerHandle
  /** The channel towards the counterpart */
  channel: ChannelHandle
}

/**
 * Creates a broker on a mock window with one channel towards a counterpart.
 *
 * @param config - The broker, window, provider, and channel configuration
 * @returns The broker and its channel
 *
 * @example Building the initiator of a v3 pair
 * ```typescript
 * const a = createParty({ name: 'a', contract, window: windowA, counterpart: windowB, providers: { v3: createV3Provider() } })
 * a.channel.connect()
 * ```
 */
export function createParty(config: PartyConfig): Party {
  const broker = createBroker({
    name: config.name,
    contract: config.contract,
    window: config.window as unknown as Window,
    settings: config.providers ? { security: { protocols: config.providers } } : {},
  })
  const channel = broker.addChannel(config.channelName ?? 'to-peer', config.counterpart as unknown as Window, config.channelSettings ?? {})
  return { broker, channel }
}

/**
 * Destroys every channel the given parties' brokers hold, silently.
 *
 * Releases the security transports and handshake timers so a suite that
 * runs on the real clock leaves nothing scheduled behind.
 *
 * @param parties - The parties to tear down
 *
 * @example Tearing down after each test
 * ```typescript
 * afterEach(() => destroyParties(...parties))
 * ```
 */
export function destroyParties(...parties: Party[]): void {
  for (const party of parties) {
    // why: `channels` lists JSON snapshots; the handle that owns the transport and timers is resolved by id.
    party.broker.channels.forEach((snapshot) => party.broker.getChannel(snapshot.id)?.destroy(false))
  }
}

/**
 * A channel event as recorded by {@link collectEvents}.
 */
export interface RecordedEvent {
  /** The event name */
  event: ChannelEvent
  /** The event payload */
  data: unknown
}

/**
 * Records the channel's lifecycle events in the order they fire.
 *
 * @param channel - The channel to observe
 * @param events - The event names to keep; every event when omitted
 * @returns The live list of recorded events
 *
 * @example Waiting for the session to be confirmed
 * ```typescript
 * const ready = collectEvents(channel, ['security-ready'])
 * await waitFor(() => ready.length === 1)
 * ```
 */
export function collectEvents(channel: ChannelHandle, events?: ChannelEvent[]): RecordedEvent[] {
  const recorded: RecordedEvent[] = []
  channel.on((event, data) => {
    if (!events || events.includes(event)) {
      recorded.push({ event, data })
    }
  })
  return recorded
}

/**
 * Every payload posted into a mock window, in order.
 *
 * @param target - The window whose inbound posts are read
 * @returns The posted payloads: plaintext actions and wire frames alike
 *
 * @example Checking that only wire frames reached the counterpart
 * ```typescript
 * expect(framesTo(windowB)).toEqual([expect.any(Uint8Array)])
 * ```
 */
export function framesTo(target: MockWindow): unknown[] {
  return target.postMessage.mock.calls.map((call) => call[0] as unknown)
}

/**
 * The plaintext actions posted into a mock window, in order.
 *
 * @param target - The window whose inbound posts are read
 * @returns The posted payloads that are not wire frames
 *
 * @example Reading the replayed ACCEPT
 * ```typescript
 * expect(plaintextFramesTo(windowA)).toEqual([expect.objectContaining({ type: ACTION_TYPES.ACCEPT_CONNECTION })])
 * ```
 */
export function plaintextFramesTo(target: MockWindow): IAction[] {
  return framesTo(target).filter((frame): frame is IAction => !(frame instanceof Uint8Array))
}

/**
 * The action types posted into a mock window in plaintext, in order.
 *
 * @param target - The window whose inbound posts are read
 * @returns The types of the posted payloads that are not wire frames
 *
 * @example Checking that only the handshake travelled in plaintext
 * ```typescript
 * expect(plaintextTypesTo(windowB)).toEqual([ACTION_TYPES.REQUEST_CONNECTION, ACTION_TYPES.OPEN_CONNECTION])
 * ```
 */
export function plaintextTypesTo(target: MockWindow): string[] {
  return plaintextFramesTo(target).map((frame) => frame.type)
}

/**
 * A hello frame with a hello's exact shape whose public key is not a P-256 point.
 *
 * The protocol accepts it on shape alone, so it keys nothing: the first seal
 * or open that needs the session keys fails with `invalid-session`. Fed to a
 * session that already holds its counterpart's hello it is rejected instead.
 *
 * @param version - The protocol version byte the hello claims
 * @returns The 99 forged hello bytes
 *
 * @example Forging a v3 hello
 * ```typescript
 * simulateMessage(windowB, createForgedHello(3), 'http://host-a.com', windowA)
 * ```
 */
export function createForgedHello(version: number): Uint8Array {
  // magic: A hello is 99 bytes: the version byte, the hello type byte, a 32-byte nonce, and a 65-byte public key tagged 0x04.
  const frame = createUint8Array(99).fill(7)
  frame[0] = version
  frame[1] = 1
  frame[34] = 4
  return frame
}

/**
 * Bytes shaped like a sealed frame that no session key sealed.
 *
 * The header passes every check that precedes decryption (the version byte,
 * the data type byte, and a positive counter), so a frame long enough to
 * carry a packet fails authentication and a shorter one is malformed.
 *
 * @param version - The protocol version byte the frame claims
 * @param length - The frame length; 40 bytes by default, above the 27-byte minimum
 * @returns The forged frame bytes
 *
 * @example Forging a v3 frame
 * ```typescript
 * simulateMessage(windowA, createForgedFrame(3), 'http://host-b.com', windowB)
 * ```
 */
export function createForgedFrame(version: number, length = 40): Uint8Array {
  const frame = createUint8Array(length).fill(7)
  frame.set([version, 0, 0, 0, 0, 0, 0, 0, 0, 1], 0)
  return frame
}
