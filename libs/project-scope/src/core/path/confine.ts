import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizePath, removeTrailingSlash } from './normalize'

/**
 * Reports whether `path` is the root itself or sits beneath it.
 *
 * Compares already-normalized absolute paths. The trailing-slash guard stops a
 * sibling such as `/root-evil` from masquerading as a child of `/root`.
 *
 * @param root - Normalized absolute root path.
 * @param path - Normalized absolute path to test.
 * @returns True when `path` equals `root` or is contained within it.
 */
function contains(root: string, path: string): boolean {
  const base = removeTrailingSlash(root)
  return path === base || path.startsWith(`${base}/`)
}

/**
 * Reports whether `candidate` resolves to a location inside `root`.
 *
 * The lexical check runs first and rejects `..` traversal and absolute escapes
 * with no filesystem access at all, so a hostile path is never stat-ed. Only a
 * path that is already lexically contained is then resolved through symlinks, so
 * an in-tree link cannot tunnel outside the root — and that realpath touches
 * only paths the caller would legitimately read anyway.
 *
 * @param root - The directory the candidate must stay within.
 * @param candidate - The path to validate (resolved relative to the cwd if not absolute).
 * @returns True when the candidate is the root or contained within it.
 *
 * @example Confining a resolved import target
 * ```typescript
 * isWithinRoot('/project', '/project/src/index.ts') // true
 * isWithinRoot('/project', '/project/../etc/passwd') // false
 * ```
 */
export function isWithinRoot(root: string, candidate: string): boolean {
  if (!contains(normalizePath(resolve(root)), normalizePath(resolve(candidate)))) {
    return false
  }
  if (!existsSync(candidate)) {
    return true
  }
  return contains(normalizePath(realpathSync(root)), normalizePath(realpathSync(candidate)))
}
