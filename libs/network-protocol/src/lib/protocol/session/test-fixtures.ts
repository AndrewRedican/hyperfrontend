import type { Logger } from '@hyperfrontend/logging'
import type { Protocol, ProtocolProvider } from '../../channel/model'
import type { ProtocolSession } from '../../security/model'
import type { SessionCrypto } from './model'
import { createKeyAgreement, expandKey, getRandomValues, open, seal, stretchPassword } from '@hyperfrontend/cryptography/node'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { uint8ArrayToUtf8String, utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'

/** The Node.js primitives the session specs compose the protocol from */
export const nodeCrypto: SessionCrypto = {
  getRandomValues,
  createKeyAgreement,
  stretchPassword,
  expandKey,
  seal,
  open,
  utf8Encode: utf8StringToUint8Array,
  utf8Decode: uint8ArrayToUtf8String,
}

/** Broker ids of the two parties */
export const ids = {
  initiator: '550e8400-e29b-41d4-a716-446655440000',
  responder: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
}

/** A shared key long enough for v4 */
export const SHARED_KEY = 'session-spec-shared-key-0123456789'

/** The session each side of a spec binds to */
export interface SessionPair {
  /** The initiator's view of the session */
  readonly initiator: ProtocolSession
  /** The responder's view of the session */
  readonly responder: ProtocolSession
}

/**
 * Builds both sides' sessions for a protocol id.
 *
 * @param protocol - The negotiated protocol id both sessions carry
 * @returns The initiator's and the responder's session
 *
 * @example Binding two providers to one session
 * ```typescript
 * const { initiator, responder } = sessions('v3')
 * ```
 */
export const sessions = (protocol: string): SessionPair => ({
  initiator: { protocol, role: 'initiator', localId: ids.initiator, peerId: ids.responder },
  responder: { protocol, role: 'responder', localId: ids.responder, peerId: ids.initiator },
})

/**
 * Creates a logger that records nothing, for specs that only need a valid logger.
 *
 * @returns A silent logger
 *
 * @example Composing a provider under test
 * ```typescript
 * const provider = createSessionProtocolProvider(nodeCrypto, V3, createMockLogger())
 * ```
 */
export const createMockLogger = (): Logger => {
  const logger: Logger = {
    debug: () => void 0,
    info: () => void 0,
    warn: () => void 0,
    error: () => void 0,
    log: () => void 0,
    setLogLevel: () => void 0,
    getLogLevel: () => 'info' as const,
    channel: () => logger,
    timed: <T>(_label: string, fn: () => T): T => fn(),
    timedAsync: <T>(_label: string, fn: () => Promise<T>): Promise<T> => fn(),
  }
  return logger
}

/** Two protocol instances that have exchanged hellos */
export interface LinkedProtocols {
  /** The initiator's instance */
  readonly initiator: Protocol
  /** The responder's instance */
  readonly responder: Protocol
}

const noop = () => void 0

/**
 * Builds one protocol instance per side and exchanges their hellos, so both can seal and
 * open at once.
 *
 * @param protocol - The negotiated protocol id both instances are bound to
 * @param initiatorProvider - The provider building the initiating side
 * @param responderProvider - The provider building the answering side
 * @returns Both instances, keyed
 *
 * @example Linking two v3 instances
 * ```typescript
 * const { initiator, responder } = await link('v3', providerA, providerB)
 * ```
 */
export async function link(
  protocol: string,
  initiatorProvider: ProtocolProvider,
  responderProvider: ProtocolProvider
): Promise<LinkedProtocols> {
  const pair = sessions(protocol)
  const initiator = initiatorProvider(noop, noop, pair.initiator)
  const responder = responderProvider(noop, noop, pair.responder)
  const [initiatorHello, responderHello] = await promiseAll([initiator.hello(), responder.hello()])
  initiator.acceptHello(responderHello)
  responder.acceptHello(initiatorHello)
  return { initiator, responder }
}
