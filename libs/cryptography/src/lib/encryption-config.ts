import type { EncryptionConfig } from './encryption-config.model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Shape of the frozen encryption configuration.
 */
interface EncryptionConfigShape {
  /** Algorithm name used for encryption */
  name: EncryptionConfig['name']
}

/**
 * Frozen encryption configuration to prevent runtime tampering.
 * Using AES-GCM as the default algorithm for authenticated encryption.
 */
export const encryptionConfig: Readonly<EncryptionConfigShape> = freeze(<const>{
  name: <EncryptionConfig['name']>'AES-GCM',
})
