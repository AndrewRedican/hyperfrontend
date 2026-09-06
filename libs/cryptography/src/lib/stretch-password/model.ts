/**
 * Options accepted by `stretchPassword`.
 */
export interface StretchPasswordOptions {
  /** PBKDF2 iteration count; defaults to the library-wide 100,000 */
  readonly iterations?: number
  /** Length of the derived material in bits, a positive multiple of 8; defaults to 256 */
  readonly length?: number
}
