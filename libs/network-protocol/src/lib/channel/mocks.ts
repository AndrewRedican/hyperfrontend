import type { ProtocolSession } from '../security/model'
import type { Protocol, ProtocolProvider } from './model'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { logger } from '@hyperfrontend/logging'
import { packetOpener, packetSealer } from '../packet/creators/mocks'
import { receiver } from '../receiver/creators/mocks'
import { sender } from '../sender/creators/mocks'

export const send = sender

export const receive = receiver

/** A well-formed session for a mock protocol */
export const session: ProtocolSession = {
  protocol: 'mock',
  role: 'initiator',
  localId: '550e8400-e29b-41d4-a716-446655440000',
  peerId: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
}

/** The bytes the mock protocol treats as its hello frame */
export const helloFrame = createUint8Array([0, 1, 2, 3])

export const protocol: Protocol = {
  seal: packetSealer,
  open: packetOpener,
  hello: async () => helloFrame,
  isHello: (frame) => frame[1] === 1,
  acceptHello: () => 'accepted',
  send,
  receive,
  getLogger: () => ({ ...logger }),
}

/**
 * Provides a mock protocol instance for testing.
 *
 * @returns A mock Protocol instance
 *
 * @example Getting a mock protocol
 * ```typescript
 * const protocol = protocolProvider(sendFn, receiveFn, session)
 * // => { seal, open, hello, isHello, acceptHello, send, receive, getLogger }
 * ```
 */
export const protocolProvider: ProtocolProvider = () => protocol
