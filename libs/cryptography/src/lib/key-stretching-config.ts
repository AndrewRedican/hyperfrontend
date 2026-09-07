import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Parameters shared by every password-stretching operation in the library.
 */
export interface KeyStretchingConfig {
  /** Key derivation algorithm name */
  readonly name: 'PBKDF2'
  /** Hash the derivation iterates */
  readonly hash: 'SHA-256'
  /** Iteration count: the work factor an attacker pays per password guess */
  readonly iterations: number
}

/**
 * PBKDF2 parameters used by `generateKey` and `stretchPassword`.
 *
 * 100,000 SHA-256 iterations cost roughly 17 ms on commodity hardware, which is the
 * intended price for one password guess and the reason password stretching belongs at
 * session or storage boundaries rather than on a per-message path.
 */
export const keyStretchingConfig: KeyStretchingConfig = freeze({
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 100_000,
} as const)
