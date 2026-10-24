/**
 * The walk behind the rules that sweep the whole workspace from its root manifest.
 *
 * @module rules/workspace/shared/sweep
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Directories never descended into: installed, built, cached, generated or private trees. */
const SKIPPED = ['node_modules', '.git', 'dist', 'coverage', 'tmp', 'out', '.next', '.nx', '.angular', '.verdaccio', '.claude', '_']

/** One entry the sweep reached. */
export interface SweptEntry {
  /** The entry's own name. */
  readonly name: string
  /** Its POSIX path relative to the root the sweep started from. */
  readonly path: string
  /** The names along that path, the entry's own last. */
  readonly segments: readonly string[]
  /** Whether it is a directory. */
  readonly directory: boolean
}

/**
 * Visits every file and directory below a root, depth first in code-unit order of names, never entering a skipped directory.
 *
 * @param root - The directory to start from
 * @param visit - Called once per entry; answering `false` for a directory keeps the sweep out of it
 *
 * @example Listing every `.vscode` directory without looking inside one
 * ```typescript
 * const found: string[] = []
 * sweep(root, (entry) => {
 *   if (entry.name !== '.vscode') return true
 *   found.push(entry.path)
 *   return false
 * })
 * ```
 */
export function sweep(root: string, visit: (entry: SweptEntry) => boolean): void {
  const walk = (directory: string, parents: readonly string[]): void => {
    // why: readdirSync sorts by byte on POSIX but returns NTFS's case-insensitive order on Windows, so the walk sorts for itself.
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
    for (const entry of entries) {
      const segments = [...parents, entry.name]
      const directoryEntry = entry.isDirectory()
      if (
        visit({ name: entry.name, path: segments.join('/'), segments, directory: directoryEntry }) &&
        directoryEntry &&
        !SKIPPED.includes(entry.name)
      ) {
        walk(join(directory, entry.name), segments)
      }
    }
  }
  walk(root, [])
}
