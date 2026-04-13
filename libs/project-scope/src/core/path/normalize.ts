import { normalize, sep } from 'node:path'

/**
 * Normalize path separators to forward slashes.
 *
 * @param filePath - Path to normalize
 * @returns Normalized path with forward slashes
 *
 * @example Normalizing path separators
 * ```typescript
 * const path = normalizePath('src\\components\\Button.tsx')
 * // => 'src/components/Button.tsx'
 * ```
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return ''
  const normalized = normalize(filePath)
  return sep === '\\' ? normalized.replace(/\\/g, '/') : normalized
}

/**
 * Convert path separators to forward slashes using POSIX style.
 * Resolves `.` and `..` segments for cross-platform configuration.
 *
 * @param filePath - The input path to convert
 * @returns Path with forward slashes and resolved segments
 *
 * @example Converting to forward slashes
 * ```typescript
 * const path = normalizeToForwardSlashes('./src/../lib/utils')
 * // => 'lib/utils'
 * ```
 */
export function normalizeToForwardSlashes(filePath: string): string {
  if (!filePath) return ''
  return normalize(filePath).split(sep).join('/')
}

/**
 * Convert path to use the operating system's native separator.
 *
 * @param filePath - The input path to convert
 * @returns Path with native separators (backslash on Windows, forward slash elsewhere)
 *
 * @example Converting to native separators
 * ```typescript
 * const path = normalizeToNative('src/components/Button.tsx')
 * // => 'src\\components\\Button.tsx' on Windows
 * // => 'src/components/Button.tsx' on Unix
 * ```
 */
export function normalizeToNative(filePath: string): string {
  if (!filePath) return ''
  return normalize(filePath.replace(/[/\\]/g, sep))
}

/**
 * Strip any trailing forward or back slashes from a path.
 *
 * @param filePath - Path that may have trailing slashes
 * @returns Path with trailing slashes removed
 *
 * @example Removing trailing slashes
 * ```typescript
 * removeTrailingSlash('src/components/')
 * // => 'src/components'
 *
 * removeTrailingSlash('path\\to\\dir\\')
 * // => 'path\\to\\dir'
 * ```
 */
export function removeTrailingSlash(filePath: string): string {
  let i = filePath.length
  while (i > 0 && (filePath[i - 1] === '/' || filePath[i - 1] === '\\')) {
    i--
  }
  return filePath.slice(0, i)
}

/**
 * Append a forward slash to the path if not already present.
 *
 * @param filePath - Path to process
 * @returns Path with trailing forward slash
 *
 * @example Ensuring trailing slash
 * ```typescript
 * ensureTrailingSlash('src/components')
 * // => 'src/components/'
 *
 * ensureTrailingSlash('already/has/')
 * // => 'already/has/'
 * ```
 */
export function ensureTrailingSlash(filePath: string): string {
  const normalized = removeTrailingSlash(filePath)
  return normalized + '/'
}
