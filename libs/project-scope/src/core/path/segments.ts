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
 */
export function getBasename(filePath: string, ext?: string): string {
  return basename(filePath, ext)
}

/**
 * Get directory name of path.
 *
 * @param filePath - Path to extract directory from
 * @returns Directory name
 */
export function getDirname(filePath: string): string {
  return normalizePath(dirname(filePath))
}

/**
 * Get file extension (including dot).
 *
 * @param filePath - Path to extract extension from
 * @returns Extension including dot (e.g., '.ts')
 */
export function getExtension(filePath: string): string {
  return extname(filePath)
}

/**
 * Get filename without extension.
 *
 * @param filePath - Path to extract name from
 * @returns Filename without extension
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
