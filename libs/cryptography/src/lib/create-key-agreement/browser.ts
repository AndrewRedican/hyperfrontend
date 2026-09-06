import { subtle } from '../subtle/browser'
import { createKeyAgreementFactory } from './create-key-agreement'

/**
 * Creates an ephemeral P-256 key agreement backed by the Web Crypto API.
 *
 * @returns A fresh agreement exposing this side's public key and `deriveSecret`
 */
export const createKeyAgreement = createKeyAgreementFactory(subtle)
