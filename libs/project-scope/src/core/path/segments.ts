import { basename, dirname, extname, parse } from 'node:path'
import { normalizePath } from './normalize'

/**
 * Parsed path components.
 */
export interface ParsedPath {
  /** Root of the path (e.g., "/" or "C:\\") */
  root: string
  /** Directory name */
  dir: string
  /** Base name with extension */
  base: string
  /** File extension including dot */
  ext: string
  /** File name without extension */
  name: string
}

/**
 * Split path into segments.
 *
 * @param filePath - Path to split
 * @returns Array of path segments
 *
 * @example Splitting path into segments
 * ```typescript
 * pathSegments('src/components/Button.tsx')
 * // => ['src', 'components', 'Button.tsx']
 * ```
 */
export function pathSegments(filePath: string): string[] {
  return filePath.split(/[/\\]/).filter((segment) => segment.length > 0)
}

/**
 * Get basename of path.
 *
 * @param filePath - Path to extract basename from
 * @param ext - Optional extension to strip
 * @returns Basename of path
 *
 * @example Getting basename
 * ```typescript
 * getBasename('src/components/Button.tsx')
 * // => 'Button.tsx'
 *
 * getBasename('src/components/Button.tsx', '.tsx')
 * // => 'Button'
 * ```
 */
export function getBasename(filePath: string, ext?: string): string {
  return basename(filePath, ext)
}

/**
 * Get directory name of path.
 *
 * @param filePath - Path to extract directory from
 * @returns Directory name
 *
 * @example Getting directory name
 * ```typescript
 * getDirname('src/components/Button.tsx')
 * // => 'src/components'
 * ```
 */
export function getDirname(filePath: string): string {
  return normalizePath(dirname(filePath))
}

/**
 * Get file extension (including dot).
 *
 * @param filePath - Path to extract extension from
 * @returns Extension including dot (e.g., '.ts')
 *
 * @example Getting file extension
 * ```typescript
 * getExtension('src/utils/helpers.ts')
 * // => '.ts'
 *
 * getExtension('package.json')
 * // => '.json'
 * ```
 */
export function getExtension(filePath: string): string {
  return extname(filePath)
}

/**
 * Get filename without extension.
 *
 * @param filePath - Path to extract name from
 * @returns Filename without extension
 *
 * @example Getting filename without extension
 * ```typescript
 * getFileNameWithoutExtension('src/utils/helpers.ts')
 * // => 'helpers'
 * ```
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const parsed = parse(filePath)
  return parsed.name
}

/**
 * Parse path into components.
 *
 * @param filePath - Path to parse
 * @returns Parsed path components
 *
 * @example Parsing path components
 * ```typescript
 * const parsed = parsePath('/workspace/src/index.ts')
 * // => { root: '/', dir: '/workspace/src', base: 'index.ts', ext: '.ts', name: 'index' }
 * ```
 */
export function parsePath(filePath: string): ParsedPath {
  const parsed = parse(filePath)
  return {
    root: parsed.root,
    dir: normalizePath(parsed.dir),
    base: parsed.base,
    ext: parsed.ext,
    name: parsed.name,
  }
}
