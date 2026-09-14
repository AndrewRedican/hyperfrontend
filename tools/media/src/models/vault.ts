import type { Mark } from './banner'

/**
 * One platform built-in the package copies, and what happens to each side of
 * it: the name on the shelf, the export the copy is imported as, what the
 * intruder writes over the global, and what each of the two then answers.
 */
export interface VaultPair {
  /** The built-in's name as it sits on the shelf, such as `Object.keys`. */
  global: string
  /** The package export the copy is imported as, such as `keys`. */
  copy: string
  /** The subpath the copy is imported from, written under its chip, such as `built-in-copy/object`. */
  subpath: string
  /** What the intruder writes over the built-in, written under its struck name, such as `() => []`. */
  replacement: string
  /** What the rewritten global answers, landed in the shelf's slot. */
  shelfAnswer: string
  /** What the copy answers, landed in the vault's slot. */
  vaultAnswer: string
}

/** Everything a scene tells the vault stage. */
export interface VaultConfig {
  /** The package's mark: on the chips, and as the vault's watermark. */
  mark: Mark
  /** The name of the object the shelf stands for, written small at its left end. */
  shelf: string
  /** The file name the intruder walks in under. */
  intruder: string
  /** The value the questions are asked about, written in the asker's field. */
  value: string
  /** The built-ins copied, in the order they are captured, rewritten and asked about. */
  pairs: readonly VaultPair[]
  /** How long the frame holds after the band settles under the copies' answers. */
  restMs?: number
}
