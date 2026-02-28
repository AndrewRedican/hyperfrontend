import type { EncryptionConfig } from './encryption-config.model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Frozen encryption configuration to prevent runtime tampering.
 * Using AES-GCM as the default algorithm for authenticated encryption.
 */
export const encryptionConfig = freeze(<const>{
  name: <EncryptionConfig['name']>'AES-GCM',
})
