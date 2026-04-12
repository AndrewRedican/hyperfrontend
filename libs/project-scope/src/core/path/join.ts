import { join as nodeJoin, posix } from 'node:path'

/**
 * Join path segments.
 * Uses platform-specific separators (e.g., / or \).
 *
 * @param paths - Path segments to join
 * @returns Joined path
 *
 * @example Joining path segments
 * ```typescript
 * const fullPath = join('src', 'components', 'Button.tsx')
 * // => 'src/components/Button.tsx' (or 'src\\components\\Button.tsx' on Windows)
 * ```
 */
export function join(...paths: string[]): string {
  return nodeJoin(...paths)
}

/**
 * Join path segments using POSIX separators (/).
 * Always uses forward slashes regardless of platform.
 *
 * @param paths - Path segments to join
 * @returns Joined path with forward slashes
 *
 * @example Joining paths with forward slashes
 * ```typescript
 * const configPath = joinPosix('config', 'settings', 'app.json')
 * // => 'config/settings/app.json'
 * ```
 */
export function joinPosix(...paths: string[]): string {
  return posix.join(...paths)
}
