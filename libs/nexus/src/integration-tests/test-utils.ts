import type { WaitOptions } from '@hyperfrontend/testing'
import type { FakeWindow } from '@hyperfrontend/testing/browser'
import type { BrokerHandle } from '../broker/types'
import type { IAction } from '../types/action'
import type { ChannelHandle, IChannelSettings } from '../types/channel'
import type { IChannelContract } from '../types/contract'
import type { ChannelEvent } from '../types/events'
import type { SecurityProtocolProviders, SecurityProvider } from '../types/security'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol as createV3Protocol } from '@hyperfrontend/network-protocol/browser/v3'
import { createProtocol as createV4Protocol } from '@hyperfrontend/network-protocol/browser/v4'
import { createBroker } from '../broker/factory'

/**
 * How long and how often the suites that run on the real clock poll for an outcome.
 *
 * The secure session's hello exchange and sealing run through WebCrypto, so the suites
 * that drive real providers cannot advance a fake clock past them; they wait for the
 * observable outcome instead. The 20ms poll stays far below the shortest deadline the
 * suites configure (300ms) while staying cheap.
 *
 * @example Waiting for both sides to confirm the session
 * ```typescript
 * await waitUntil(() => readyA.length === 1 && readyB.length === 1, SESSION_WAIT)
 * ```
 */
export const SESSION_WAIT: WaitOptions = { timeout: 5000, interval: 20 }

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
  window: Window
  /** Counterpart window the channel targets */
  counterpart: Window
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
 * Creates a broker on a window with one channel towards a counterpart.
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
    window: config.window,
    settings: config.providers ? { security: { protocols: config.providers } } : {},
  })
  const channel = broker.addChannel(config.channelName ?? 'to-peer', config.counterpart, config.channelSettings ?? {})
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
 * await waitUntil(() => ready.length === 1, SESSION_WAIT)
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
 * The plaintext actions posted into a fake window, in order.
 *
 * @param target - The window whose inbound posts are read
 * @returns The posted payloads that are not wire frames
 *
 * @example Reading the replayed ACCEPT
 * ```typescript
 * expect(plaintextFramesTo(windowA)).toEqual([expect.objectContaining({ type: ACTION_TYPES.ACCEPT_CONNECTION })])
 * ```
 */
export function plaintextFramesTo(target: FakeWindow): IAction[] {
  return target.posted().filter((frame): frame is IAction => !(frame instanceof Uint8Array))
}

/**
 * The action types posted into a fake window in plaintext, in order.
 *
 * @param target - The window whose inbound posts are read
 * @returns The types of the posted payloads that are not wire frames
 *
 * @example Checking that only the handshake travelled in plaintext
 * ```typescript
 * expect(plaintextTypesTo(windowB)).toEqual([ACTION_TYPES.REQUEST_CONNECTION, ACTION_TYPES.OPEN_CONNECTION])
 * ```
 */
export function plaintextTypesTo(target: FakeWindow): string[] {
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
 * windowB.receive(createForgedHello(3), { origin: 'http://host-a.com', source: windowA })
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
 * windowA.receive(createForgedFrame(3), { origin: 'http://host-b.com', source: windowB })
 * ```
 */
export function createForgedFrame(version: number, length = 40): Uint8Array {
  const frame = createUint8Array(length).fill(7)
  frame.set([version, 0, 0, 0, 0, 0, 0, 0, 0, 1], 0)
  return frame
}
