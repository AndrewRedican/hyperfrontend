import type { BinFormatSpec, BinScriptFormat } from '../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

/**
 * Normalizes a bin's format declaration to an explicit list.
 *
 * `BinFormatSpec` permits either a single `BinScriptFormat` or an array of them,
 * but every consumer — package.json `bin` synthesis, the script build, and the
 * native SEA build — needs the list shape, so a scalar is wrapped in a singleton.
 * The casts are required because `isArray` does not narrow the
 * `BinScriptFormat | BinScriptFormat[]` union on its false branch.
 *
 * @param format - The per-bin format declaration: a single format or a list.
 * @returns The declared formats as a list.
 *
 * @example Normalizing scalar and list declarations
 * ```typescript
 * normalizeFormats('cjs') // => ['cjs']
 * normalizeFormats(['cjs', 'esm']) // => ['cjs', 'esm']
 * ```
 */
export const normalizeFormats = (format: BinFormatSpec): BinScriptFormat[] =>
  isArray(format) ? <BinScriptFormat[]>format : [<BinScriptFormat>format]
