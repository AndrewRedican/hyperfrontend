import { realpathSync } from 'node:fs'
import { resolve, relative, join, isAbsolute as nodeIsAbsolute } from 'node:path'
import { exists } from '../fs/stat'
import { normalizePath } from './normalize'

/**
 * Resolve path segments to an absolute path.
 *
 * @param segments - Path segments to resolve
 * @returns Resolved absolute path with normalized separators
 *
 * @example
 * ```typescript
 * const absPath = resolvePath('src', 'components', 'Button.tsx')
 * // => '/workspace/project/src/components/Button.tsx'
 * ```
 */
export function resolvePath(...segments: string[]): string {
  return normalizePath(resolve(...segments))
}

/**
 * Resolve path relative to workspace root.
 *
 * @param workspaceRoot - Workspace root directory
 * @param segments - Path segments relative to workspace
 * @returns Resolved absolute path with normalized separators
 *
 * @example
 * ```typescript
 * const configPath = resolveFromWorkspace('/workspace', 'config', 'app.json')
 * // => '/workspace/config/app.json'
 * ```
 */
export function resolveFromWorkspace(workspaceRoot: string, ...segments: string[]): string {
  return normalizePath(resolve(workspaceRoot, ...segments))
}

/**
 * Resolve symlinks to real path.
 *
 * @param filePath - Path to resolve
 * @returns Real path or null if path doesn't exist
 *
 * @example
 * ```typescript
 * const realPath = resolveRealPath('./node_modules/.bin/tsc')
 * // => '/workspace/node_modules/typescript/bin/tsc'
 * ```
 */
export function resolveRealPath(filePath: string): string | null {
  if (!exists(filePath)) {
    return null
  }
  try {
    return normalizePath(realpathSync(filePath))
  } catch {
    return null
  }
}

/**
 * Compute the normalized path from source directory to target.
 *
 * @param from - Source path (base directory)
 * @param to - Target path to reach
 * @returns Relative path from source to target with forward slashes
 *
 * @example
 * ```typescript
 * relativePath('/workspace/src/utils', '/workspace/lib/helpers')
 * // => '../../lib/helpers'
 * ```
 */
export function relativePath(from: string, to: string): string {
  return normalizePath(relative(from, to))
}

/**
 * Join path segments.
 *
 * @param segments - Path segments to join
 * @returns Joined path with normalized separators
 *
 * @example
 * ```typescript
 * joinPath('src', 'components', 'Button.tsx')
 * // => 'src/components/Button.tsx'
 * ```
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(join(...segments))
}

/**
 * Check if path is absolute.
 *
 * @param filePath - Path to check
 * @returns True if path is absolute
 *
 * @example
 * ```typescript
 * isAbsolute('/workspace/src/index.ts')
 * // => true
 *
 * isAbsolute('./src/index.ts')
 * // => false
 * ```
 */
export function isAbsolute(filePath: string): boolean {
  return nodeIsAbsolute(filePath)
}

/**
 * Calculate offset from root (e.g., "../../../").
 *
 * @param filePath - Path to calculate offset for
 * @returns Relative offset path (e.g., "../../")
 *
 * @example
 * ```typescript
 * offsetFromRoot('libs/utils/src')
 * // => '../../../'
 *
 * offsetFromRoot('apps')
 * // => '../'
 * ```
 */
export function offsetFromRoot(filePath: string): string {
  const segments = normalizePath(filePath).split('/').filter(Boolean)
  if (segments.length === 0) return ''
  return segments.map(() => '..').join('/') + '/'
}
