import { join as nodeJoin, posix } from 'node:path'

/**
 * Join path segments.
 * Uses platform-specific separators (e.g., / or \).
 *
 * @param paths - Path segments to join
 * @returns Joined path
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
 */
export function joinPosix(...paths: string[]): string {
  return posix.join(...paths)
}
