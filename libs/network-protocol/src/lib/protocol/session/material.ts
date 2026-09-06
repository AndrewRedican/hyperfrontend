import type { LocalMaterial, SessionCrypto } from './model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { HELLO_NONCE_LENGTH } from './frame'

/**
 * Mints this side's material for one session: a fresh nonce and an ephemeral key agreement.
 *
 * The agreement's private key never leaves the agreement object, so the material can be
 * held for the session's lifetime and collected with it.
 *
 * @param crypto - The platform primitives
 * @returns The nonce and the agreement
 *
 * @example Minting at session start
 * ```typescript
 * const material = await mintLocalMaterial(crypto)
 * const hello = encodeHello(version, material.nonce, material.agreement.publicKey)
 * ```
 */
export async function mintLocalMaterial(crypto: SessionCrypto): Promise<LocalMaterial> {
  const nonce = crypto.getRandomValues(HELLO_NONCE_LENGTH)
  const agreement = await crypto.createKeyAgreement()
  return freeze({ nonce, agreement })
}
