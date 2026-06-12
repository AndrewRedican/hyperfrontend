import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, getDirname, join, readFileContent } from '@hyperfrontend/project-scope/core'
import { collectChunkSpecifiers, hasDynamicSpecifier } from './specifiers'

const log = logger.channel('builder:bundle:dependencies:prune')

const isUnderRoot = (path: string, depsRoot: string): boolean => path === depsRoot || path.startsWith(`${depsRoot}/`)

/**
 * Computes the set of files reachable from a set of root files by following
 * literal relative specifiers, restricted to targets under `depsRoot`.
 *
 * Breadth-first traversal: each visited file's text is read, scanned once for
 * specifiers, then released before the next file — so only one chunk's source
 * is resident at a time and the memory profile stays flat. Targets that resolve
 * outside `depsRoot` (the package's own non-dependency code) are ignored; the
 * roots themselves are always included so callers can use the returned set as a
 * single live-membership oracle.
 *
 * If any reached file contains a dynamic (non-literal) `import(`/`require(`,
 * the chunk graph cannot be fully resolved, so the function logs and returns
 * `null` — the guaranteed-safe sentinel that disables orphan deletion for the
 * run.
 *
 * @param roots - Absolute paths to the root files reachability starts from.
 * @param depsRoot - Absolute path to the `_dependencies/` directory; traversal
 * never leaves it.
 * @param resolveTarget - Maps each resolved specifier target before it is
 * visited; defaults to identity. The d.ts pass passes a mapper that rewrites a
 * runtime specifier (`'.../index.js'`) to its declaration sibling
 * (`'.../index.d.ts'`) so traversal follows the type graph, never the runtime
 * graph.
 * @returns The set of reachable absolute file paths, or `null` when a dynamic
 * specifier forces a safety bail.
 *
 * @example Reachability from an ESM entry chunk
 * ```typescript
 * const live = computeReachable(['/dist/libs/foo/index.esm.js'], '/dist/libs/foo/_dependencies')
 * if (live && !live.has(orphanChunk)) unlinkSync(orphanChunk)
 * ```
 */
export const computeReachable = (
  roots: string[],
  depsRoot: string,
  resolveTarget: (target: string) => string = (target) => target
): Set<string> | null => {
  const reachable = createSet<string>([])
  const queue: string[] = []
  for (const root of roots) {
    if (exists(root) && !reachable.has(root)) {
      reachable.add(root)
      queue.push(root)
    }
  }
  let head = 0
  while (head < queue.length) {
    const file = <string>queue[head]
    head += 1
    const source = readFileContent(file)
    if (hasDynamicSpecifier(source)) {
      log.warn(`dynamic import/require in ${file}; skipping dependency orphan prune for safety`)
      return null
    }
    const dir = getDirname(file)
    for (const spec of collectChunkSpecifiers(source)) {
      const target = resolveTarget(join(dir, spec))
      if (isUnderRoot(target, depsRoot) && exists(target) && !reachable.has(target)) {
        reachable.add(target)
        queue.push(target)
      }
    }
  }
  return reachable
}
