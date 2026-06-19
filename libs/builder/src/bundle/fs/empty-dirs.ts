import { rmdirSync } from 'node:fs'
import { readDirectory } from '@hyperfrontend/project-scope/core'

/**
 * Post-order removal of every empty directory under `root` (`root` itself is
 * left intact).
 *
 * Children are visited before their parent so a directory whose only contents
 * are now-empty subdirectories is itself removed in the same pass. The sweep
 * only ever re-reads directories it just enumerated, so `readDirectory` (which
 * throws on a missing path) is always safe here.
 *
 * @param root - Absolute path to the directory whose empty descendants should be
 * pruned. Assumed to exist; only its descendants are candidates for removal.
 * @returns The number of directories removed.
 *
 * @example Sweeping a package output tree
 * ```typescript
 * const removed = removeEmptyDirs(context.outputPath)
 * ```
 */
export const removeEmptyDirs = (root: string): number => {
  let removed = 0
  const visit = (dir: string): void => {
    for (const entry of readDirectory(dir)) if (entry.isDirectory) visit(entry.path)
    if (readDirectory(dir).length === 0) {
      rmdirSync(dir)
      removed += 1
    }
  }
  for (const entry of readDirectory(root)) if (entry.isDirectory) visit(entry.path)
  return removed
}
