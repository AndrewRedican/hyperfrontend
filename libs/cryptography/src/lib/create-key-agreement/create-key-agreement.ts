import type { KeyAgreement } from './model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

const CURVE = freeze({ name: 'ECDH', namedCurve: 'P-256' } as const)

// magic: An uncompressed P-256 point is a 0x04 tag followed by the 32-byte x and y coordinates.
const UNCOMPRESSED_POINT_LENGTH = 65
const UNCOMPRESSED_POINT_TAG = 0x04

/**
 * Creates a factory for ephemeral P-256 key agreements.
 *
 * Each call to the returned factory generates a fresh key pair. Two parties that exchange
 * their public keys and each call `deriveSecret` with the other's key obtain the same
 * 32-byte secret; a party that only observed the exchange cannot.
 *
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @returns A factory that creates one key agreement per call
 *
 * @example Agreeing a secret across a channel
 * ```typescript
 * const createKeyAgreement = createKeyAgreementFactory(crypto.subtle)
 * const mine = await createKeyAgreement()
 * send(mine.publicKey)
 * const secret = await mine.deriveSecret(await receivePeerPublicKey())
 * ```
 */
export function createKeyAgreementFactory(subtle: SubtleCrypto): () => Promise<KeyAgreement> {
  return async function createKeyAgreement(): Promise<KeyAgreement> {
    const pair = await subtle.generateKey(CURVE, false, ['deriveBits'])
    const publicKey = createUint8Array(await subtle.exportKey('raw', pair.publicKey))

    const deriveSecret = async (peerPublicKey: Uint8Array): Promise<Uint8Array> => {
      if (
        !(peerPublicKey instanceof Uint8Array) ||
        peerPublicKey.length !== UNCOMPRESSED_POINT_LENGTH ||
        peerPublicKey[0] !== UNCOMPRESSED_POINT_TAG
      ) {
        throw createError('Cannot derive a shared secret from an invalid peer public key')
      }
      let peerKey: CryptoKey
      try {
        peerKey = await subtle.importKey('raw', peerPublicKey as BufferSource, CURVE, false, [])
      } catch {
        throw createError('Cannot derive a shared secret from an invalid peer public key')
      }
      return createUint8Array(await subtle.deriveBits({ name: CURVE.name, public: peerKey }, pair.privateKey, 256))
    }

    return freeze({ publicKey, deriveSecret })
  }
}
