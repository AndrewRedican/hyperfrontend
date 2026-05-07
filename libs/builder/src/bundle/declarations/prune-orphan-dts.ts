import type { BuildContext, EntryPoint } from '../../models'
import { unlinkSync } from 'node:fs'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, isDirectory, join, readDirectory } from '@hyperfrontend/project-scope/core'

const log = logger.channel('builder:bundle:declarations:prune-orphans')

const ORPHAN_DTS_RE = /\.d\.ts$|\.d\.ts\.map$/
const KEEP_NAMES = createSet<string>(['index.d.ts', 'index.d.ts.map'])

const entryDirOf = (entry: EntryPoint, context: BuildContext): string =>
  entry.isRoot ? context.outputPath : join(context.outputPath, entry.srcPath)

const isInDependenciesRoot = (path: string, depsRoot: string): boolean => path === depsRoot || path.startsWith(`${depsRoot}/`)

const pruneOrphansInDir = (dirPath: string): number => {
  if (!exists(dirPath) || !isDirectory(dirPath)) return 0
  let removed = 0
  for (const entry of readDirectory(dirPath)) {
    if (!entry.isFile) continue
    if (!ORPHAN_DTS_RE.test(entry.name)) continue
    if (KEEP_NAMES.has(entry.name)) continue
    unlinkSync(entry.path)
    removed += 1
  }
  return removed
}

/**
 * Removes per-source `.d.ts` / `.d.ts.map` files that tsc emits alongside
 * the bundled `index.d.ts` in each entry directory.
 *
 * The per-entry pipeline runs `rollup-plugin-dts` over `index.d.ts` and the
 * orphan per-source files (e.g., `build-native.d.ts`, `synthesize.d.ts`) are
 * left behind. They are not exposed via `package.json#exports` but bloat the
 * tarball and mis-route IDE go-to-definition into files that are not the
 * actual public types surface (Phase 14 §3 / Decision #59).
 *
 * Safety rails:
 * - Only walks directories that correspond to a discovered entry point.
 * - Never recurses; sibling entry directories are visited individually.
 * - Skips anything inside `_dependencies/` so bundled-dep type pre-pass output
 *   is preserved.
 *
 * @param context - Resolved build context.
 * @returns The total number of `.d.ts` / `.d.ts.map` files removed.
 *
 * @example Pruning orphans after generateDeclarations
 * ```typescript
 * const removed = pruneOrphanDeclarations(context)
 * ```
 */
export const pruneOrphanDeclarations = (context: BuildContext): number => {
  const depsRoot = join(context.outputPath, '_dependencies')
  let total = 0
  for (const entry of context.entryPointDiscovery.entryPoints) {
    const dir = entryDirOf(entry, context)
    if (isInDependenciesRoot(dir, depsRoot)) continue
    const removed = pruneOrphansInDir(dir)
    total += removed
  }
  if (total > 0) log.info(`pruned ${total} orphan declaration file(s)`)
  return total
}
