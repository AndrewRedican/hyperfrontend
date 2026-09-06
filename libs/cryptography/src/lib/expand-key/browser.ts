import { subtle } from '../subtle/browser'
import { createExpandKey } from './create-expand-key'

/**
 * Expands input key material into a non-extractable AES-GCM-256 key with HKDF-SHA256 (browser implementation).
 *
 * @param ikm - The input key material, such as an agreed or stretched secret
 * @param salt - The salt binding the key to one session
 * @param info - Context bytes that distinguish keys derived from the same material
 * @param usages - The operations the key may perform: `'encrypt'`, `'decrypt'`, or both
 * @returns A non-extractable AES-GCM key limited to the given usages
 */
export const expandKey = createExpandKey(subtle)
