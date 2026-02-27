import type { EncryptionConfig } from './encryption-config.model'

/**
 * Frozen encryption configuration to prevent runtime tampering.
 * Using AES-GCM as the default algorithm for authenticated encryption.
 */
export const encryptionConfig = Object.freeze(<const>{
  name: <EncryptionConfig['name']>'AES-GCM',
})
