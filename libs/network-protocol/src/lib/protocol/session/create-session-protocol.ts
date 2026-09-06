import type { Logger } from '@hyperfrontend/logging'
import type { Protocol } from '../../channel/model'
import type { SerializedData } from '../../data/model'
import type { UnencryptedPacket, WirePacket } from '../../packet/model'
import type { ReceivePacketFn } from '../../receiver/model'
import type { HelloOutcome, ProtocolSession } from '../../security/model'
import type { SendPacketFn } from '../../sender/model'
import type { PeerMaterial, SessionCrypto, SessionKeys, SessionProtocolDefinition } from './model'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { deserializeData, serializeData } from '../../data/model'
import { isValidUnencryptedPacket } from '../../packet/validations/is-valid-unencrypted-packet'
import { createProtocolError, ProtocolErrorCode } from '../../security/errors'
import { deriveSessionKeys } from './derive-keys'
import {
  assembleFrame,
  decodeHeader,
  decodeHello,
  encodeHeader,
  encodeHello,
  HEADER_LENGTH,
  isHelloFrame,
  MAX_COUNTER,
  MIN_FRAME_LENGTH,
  nonceFor,
} from './frame'
import { mintLocalMaterial } from './material'

/** What a session protocol instance is built from */
export interface SessionProtocolInput {
  /** The platform primitives */
  readonly crypto: SessionCrypto
  /** The protocol's id, version byte, and shared key */
  readonly definition: SessionProtocolDefinition
  /** The negotiated session */
  readonly session: ProtocolSession
  /** Transmits sealed frames */
  readonly send: SendPacketFn
  /** Receives opened packets */
  readonly receive: ReceivePacketFn
  /** The logger the channel's pipelines log through */
  readonly logger: Logger
  /** The last counter this session may seal; defaults to the largest safe integer */
  readonly counterLimit?: number
}

/** A packet as it travels inside a frame: the data envelope with its message serialised */
interface WirePayload {
  /** The sender's identity */
  readonly origin: string
  /** The recipient's identity */
  readonly target: string
  /** The data envelope with its message as a JSON string */
  readonly data: SerializedData
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, index) => byte === b[index])

/**
 * Creates the protocol instance for one session.
 *
 * This side's material is minted at construction. The peer's arrives through `acceptHello`;
 * until then every seal and open waits, so the pipelines simply hold their frames. Keys are
 * derived once, on the first seal or open after both materials exist, and a derivation that
 * fails rejects every later operation with `invalid-session`. Each frame this side seals
 * carries the next counter, and each frame it opens must carry a counter above the last one
 * it accepted, checked before any decryption so a replayed or forged frame costs nothing.
 *
 * @param input - The primitives, definition, session, transport callbacks, and logger
 * @returns A protocol instance bound to the session
 *
 * @example Binding the protocol to a negotiated session
 * ```typescript
 * const protocol = createSessionProtocol({ crypto, definition, session, send, receive, logger })
 * transport.post(await protocol.hello())
 * ```
 */
export function createSessionProtocol(input: SessionProtocolInput): Protocol {
  const { crypto, definition, session, send, receive, logger, counterLimit = MAX_COUNTER } = input
  const local = mintLocalMaterial(crypto)
  let resolvePeer: (peer: PeerMaterial) => void = () => void 0
  const peer = createPromise<PeerMaterial>((resolve) => {
    resolvePeer = resolve
  })
  let acceptedHello: Uint8Array | null = null
  let keys: Promise<SessionKeys> | null = null
  let nextCounter = 1
  let lastAccepted = 0

  const deriveKeys = async (): Promise<SessionKeys> => {
    const own = await local
    const theirs = await peer
    try {
      return await deriveSessionKeys(crypto, definition, session, own, theirs)
    } catch (error) {
      throw createProtocolError(ProtocolErrorCode.InvalidSession, `The session keys could not be derived: ${(error as Error)?.message}`)
    }
  }

  const sessionKeys = (): Promise<SessionKeys> => {
    if (keys === null) {
      keys = deriveKeys()
    }
    return keys
  }

  const hello = async (): Promise<WirePacket> => {
    const own = await local
    return encodeHello(definition.version, own.nonce, own.agreement.publicKey)
  }

  const isHello = (frame: WirePacket): boolean => isHelloFrame(frame) && frame[0] === definition.version

  const acceptHello = (frame: WirePacket): HelloOutcome => {
    const decoded = isHello(frame) ? decodeHello(frame) : null
    if (decoded === null) {
      return 'rejected'
    }
    if (acceptedHello !== null) {
      // why: The first hello keys the session; a repeat is the peer's retry and anything else is a stranger, and neither may rekey a live session.
      return sameBytes(acceptedHello, frame) ? 'duplicate' : 'rejected'
    }
    acceptedHello = frame.slice()
    resolvePeer({ nonce: decoded.nonce, publicKey: decoded.publicKey })
    return 'accepted'
  }

  const seal = async (packet: UnencryptedPacket): Promise<WirePacket> => {
    if (nextCounter > counterLimit) {
      throw createProtocolError(ProtocolErrorCode.CounterExhausted, 'The session has sealed every frame it can number; open a new session')
    }
    const { send: key } = await sessionKeys()
    const header = encodeHeader(definition.version, nextCounter)
    nextCounter += 1
    const payload: WirePayload = { origin: packet.origin, target: packet.target, data: serializeData(packet.data) }
    const sealed = await crypto.seal(key, nonceFor(header), header, crypto.utf8Encode(stringify(payload)))
    return assembleFrame(header, sealed)
  }

  const open = async (frame: WirePacket): Promise<UnencryptedPacket> => {
    if (frame.length < MIN_FRAME_LENGTH) {
      throw createProtocolError(
        ProtocolErrorCode.Malformed,
        `A frame needs at least ${MIN_FRAME_LENGTH} bytes; this one has ${frame.length}`
      )
    }
    const header = frame.subarray(0, HEADER_LENGTH)
    const { version, counter } = decodeHeader(frame)
    if (version !== definition.version) {
      throw createProtocolError(
        ProtocolErrorCode.UnsupportedVersion,
        `Frame version ${version} is not ${definition.id}'s version ${definition.version}`
      )
    }
    if (counter <= lastAccepted) {
      throw createProtocolError(
        ProtocolErrorCode.Replayed,
        `Frame counter ${counter} is not above the last accepted counter ${lastAccepted}`
      )
    }
    const { receive: key } = await sessionKeys()
    let opened: Uint8Array
    try {
      opened = await crypto.open(key, nonceFor(header), header, frame.subarray(HEADER_LENGTH))
    } catch {
      throw createProtocolError(ProtocolErrorCode.AuthenticationFailed, `Frame ${counter} did not authenticate under the session keys`)
    }
    let packet: unknown
    try {
      const payload = parse(crypto.utf8Decode(opened)) as WirePayload
      packet = { origin: payload.origin, target: payload.target, data: deserializeData(payload.data) }
    } catch {
      throw createProtocolError(ProtocolErrorCode.Malformed, `Frame ${counter} authenticated but does not carry a packet`)
    }
    if (!isValidUnencryptedPacket(packet)) {
      throw createProtocolError(ProtocolErrorCode.Malformed, `Frame ${counter} authenticated but does not carry a valid packet`)
    }
    lastAccepted = counter
    return freeze(packet)
  }

  return freeze({ seal, open, hello, isHello, acceptHello, send, receive, getLogger: () => logger })
}
