import { normalize, sep } from 'node:path'

/**
 * Normalize path separators to forward slashes.
 *
 * @param filePath - Path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return ''
  // Normalize path and convert backslashes to forward slashes
  const normalized = normalize(filePath)
  return sep === '\\' ? normalized.replace(/\\/g, '/') : normalized
}

/**
 * Convert path separators to forward slashes using POSIX style.
 * Resolves `.` and `..` segments for cross-platform configuration.
 *
 * @param filePath - The input path to convert
 * @returns Path with forward slashes and resolved segments
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
 */
export function removeTrailingSlash(filePath: string): string {
  return filePath.replace(/[/\\]+$/, '')
}

/**
 * Append a forward slash to the path if not already present.
 *
 * @param filePath - Path to process
 * @returns Path with trailing forward slash
 */
export function ensureTrailingSlash(filePath: string): string {
  const normalized = removeTrailingSlash(filePath)
  return normalized + '/'
}
