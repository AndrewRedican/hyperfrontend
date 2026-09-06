import { subtle } from '../subtle/node'
import { createOpen } from './create-open'
import { createSeal } from './create-seal'

/**
 * Seals a plaintext with AES-GCM under a caller-supplied key and nonce (Node.js implementation).
 *
 * @param key - An AES-GCM key permitted to encrypt
 * @param nonce - A 12-byte nonce never reused under this key
 * @param additionalData - Bytes authenticated alongside the ciphertext but not encrypted
 * @param plaintext - The bytes to protect
 * @returns The ciphertext followed by the 16-byte authentication tag
 */
export const seal = createSeal(subtle)

/**
 * Opens a sealed message with AES-GCM under a caller-supplied key and nonce (Node.js implementation).
 *
 * @param key - An AES-GCM key permitted to decrypt
 * @param nonce - The 12-byte nonce the message was sealed with
 * @param additionalData - The bytes the sealer authenticated alongside the ciphertext
 * @param sealed - The ciphertext followed by its authentication tag
 * @returns The original plaintext
 */
export const open = createOpen(subtle)
