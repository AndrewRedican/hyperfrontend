import { subtle } from '../subtle/node'
import { createKeyAgreementFactory } from './create-key-agreement'

/**
 * Creates an ephemeral P-256 key agreement backed by the Node.js crypto module.
 *
 * @returns A fresh agreement exposing this side's public key and `deriveSecret`
 */
export const createKeyAgreement = createKeyAgreementFactory(subtle)
