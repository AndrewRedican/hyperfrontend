import type { ProtocolSession } from '../../security/model'
import type { LocalMaterial, PeerMaterial, SessionCrypto, SessionKeys, SessionProtocolDefinition } from './model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/** Namespace every key of every session is derived under */
export const KEY_INFO_PREFIX = 'hyperfrontend/network-protocol/'

// magic: OWASP's 2023 minimum for PBKDF2-HMAC-SHA256; the stretch runs once per session, so the cost lands on the handshake, not on traffic.
export const SESSION_STRETCH_ITERATIONS = 600_000

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const joined = createUint8Array(total)
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}

/**
 * Derives one session's directional keys.
 *
 * Both sides order the material by role, so they compute the same two keys and each picks
 * the sending one for its own role:
 *
 * - `salt` = initiator nonce || responder nonce
 * - `dh` = ECDH(own private key, peer public key)
 * - `ikm` = `dh`, or `dh || PBKDF2(sharedKey, salt)` when the protocol carries a shared key
 * - key for initiator-to-responder = HKDF(ikm, salt, prefix + id + "/" + initiatorId + "/" + responderId + "/i2r")
 * - key for responder-to-initiator = the same with "/r2i"
 *
 * Binding the protocol id and both identities into the info ties the keys to the negotiated
 * session; the agreement ties them to both public keys. Raw material is zeroed once the
 * keys exist.
 *
 * @param crypto - The platform primitives
 * @param definition - The protocol's id and, for v4, its shared key
 * @param session - The negotiated session
 * @param own - This side's minted material
 * @param peer - The peer's material as read off its hello
 * @returns The sending and receiving keys for this side
 *
 * @example Deriving keys once the peer's hello is in
 * ```typescript
 * const keys = await deriveSessionKeys(crypto, definition, session, material, peerMaterial)
 * ```
 */
export async function deriveSessionKeys(
  crypto: SessionCrypto,
  definition: SessionProtocolDefinition,
  session: ProtocolSession,
  own: LocalMaterial,
  peer: PeerMaterial
): Promise<SessionKeys> {
  const initiatorFirst = session.role === 'initiator'
  const salt = initiatorFirst ? concat(own.nonce, peer.nonce) : concat(peer.nonce, own.nonce)
  const initiatorId = initiatorFirst ? session.localId : session.peerId
  const responderId = initiatorFirst ? session.peerId : session.localId
  const dh = await own.agreement.deriveSecret(peer.publicKey)
  const stretched =
    definition.sharedKey === undefined
      ? null
      : await crypto.stretchPassword(definition.sharedKey, salt, { iterations: SESSION_STRETCH_ITERATIONS })
  const ikm = stretched === null ? dh : concat(dh, stretched)
  const infoFor = (direction: string) => crypto.utf8Encode(`${KEY_INFO_PREFIX}${definition.id}/${initiatorId}/${responderId}/${direction}`)
  const [initiatorToResponder, responderToInitiator] = await promiseAll([
    crypto.expandKey(ikm, salt, infoFor('i2r'), [initiatorFirst ? 'encrypt' : 'decrypt']),
    crypto.expandKey(ikm, salt, infoFor('r2i'), [initiatorFirst ? 'decrypt' : 'encrypt']),
  ])
  dh.fill(0)
  ikm.fill(0)
  stretched?.fill(0)
  return freeze(
    initiatorFirst
      ? { send: initiatorToResponder, receive: responderToInitiator }
      : { send: responderToInitiator, receive: initiatorToResponder }
  )
}
