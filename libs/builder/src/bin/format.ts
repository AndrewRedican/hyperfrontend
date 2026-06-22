import type { BinFormatSpec, BinScriptFormat } from '../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

/**
 * Normalizes a bin's format declaration to an explicit list.
 *
 * `BinFormatSpec` permits either a single `BinScriptFormat` or an array of them;
 * a scalar is wrapped in a singleton so callers always receive the list shape.
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
