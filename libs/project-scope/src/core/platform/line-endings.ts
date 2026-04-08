import { isWindows, detectCaseSensitivity } from './detect'

/** Unix line ending */
export const LF = '\n'

/** Windows line ending */
export const CRLF = '\r\n'

/**
 * Target specification for normalizing line endings.
 */
export type LineEndingStyle = 'lf' | 'crlf' | 'auto'

/**
 * Result of analyzing line endings in content.
 */
export type DetectedLineEnding = 'lf' | 'crlf' | 'mixed' | 'none'

/**
 * Get platform-appropriate line ending.
 *
 * @returns Line ending for current platform
 *
 * @example
 * ```typescript
 * const eol = getLineEnding()
 * const lines = ['line1', 'line2', 'line3']
 * const content = lines.join(eol)
 * ```
 */
export function getLineEnding(): '\n' | '\r\n' {
  return isWindows() ? CRLF : LF
}

/**
 * Get platform-appropriate path separator.
 *
 * @returns Path separator for current platform
 *
 * @example
 * ```typescript
 * const sep = getPathSeparator()
 * const fullPath = ['src', 'utils', 'helpers.ts'].join(sep)
 * ```
 */
export function getPathSeparator(): '/' | '\\' {
  return isWindows() ? '\\' : '/'
}

/**
 * Normalize line endings in content.
 *
 * @param content - Content to normalize
 * @param style - Target line ending style ('lf', 'crlf', or 'auto' for platform default)
 * @returns Content with normalized line endings
 *
 * @example
 * ```typescript
 * // Normalize to Unix line endings
 * const normalized = normalizeLineEndings('line1\r\nline2\r\n', 'lf')
 * // => 'line1\nline2\n'
 *
 * // Use platform default
 * const platformNormalized = normalizeLineEndings(content, 'auto')
 * ```
 */
export function normalizeLineEndings(content: string, style: LineEndingStyle = 'lf'): string {
  let target: string

  if (style === 'auto') {
    target = isWindows() ? CRLF : LF
  } else {
    target = style === 'crlf' ? CRLF : LF
  }

  const normalized = content.replace(/\r\n/g, LF).replace(/\r/g, LF)

  if (target === LF) {
    return normalized
  }

  return normalized.replace(/\n/g, target)
}

/**
 * Detect line ending style used in content.
 *
 * @param content - Content to analyze
 * @returns Detected line ending style
 *
 * @example
 * ```typescript
 * const ending = detectLineEnding('line1\nline2\n')
 * // => 'lf'
 *
 * const mixed = detectLineEnding('line1\r\nline2\nline3')
 * // => 'mixed'
 * ```
 */
export function detectLineEnding(content: string): DetectedLineEnding {
  const hasCRLF = content.includes(CRLF)
  const hasLFOnly = content.includes('\n') && content.replace(/\r\n/g, '').includes('\n')

  if (hasCRLF && hasLFOnly) return 'mixed'
  if (hasCRLF) return 'crlf'
  if (content.includes('\n')) return 'lf'
  return 'none'
}

/**
 * Compare paths with case sensitivity awareness.
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths are equal (respecting case sensitivity)
 *
 * @example
 * ```typescript
 * // On case-insensitive filesystem (Windows/macOS)
 * pathsEqual('src/App.tsx', 'src/app.tsx')
 * // => true
 *
 * // On case-sensitive filesystem (Linux)
 * pathsEqual('src/App.tsx', 'src/app.tsx')
 * // => false
 * ```
 */
export function pathsEqual(path1: string, path2: string): boolean {
  const caseSensitive = detectCaseSensitivity()
  if (caseSensitive) {
    return path1 === path2
  }
  return path1.toLowerCase() === path2.toLowerCase()
}
