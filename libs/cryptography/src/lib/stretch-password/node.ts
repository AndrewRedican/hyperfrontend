import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'
import { subtle } from '../subtle/node'
import { createStretchPassword } from './create-stretch-password'

/**
 * Stretches a password and a salt into raw key material with PBKDF2-HMAC-SHA256 (Node.js implementation).
 *
 * @param password - The password to stretch
 * @param salt - The salt binding the material to one context
 * @param options - Iteration count and output length; see `StretchPasswordOptions`
 * @returns The derived key material
 */
export const stretchPassword = createStretchPassword(subtle, utf8StringToUint8Array)
