import type { BuildContext, EntryPoint } from '../../models'
import { unlinkSync } from 'node:fs'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, isDirectory, join, readDirectory, readFileIfExists } from '@hyperfrontend/project-scope/core'

const log = logger.channel('builder:bundle:declarations:prune-orphans')

const ORPHAN_DTS_RE = /\.d\.ts$|\.d\.ts\.map$/
const INDEX_DTS_NAME = 'index.d.ts'
const ALWAYS_KEEP = createSet<string>(['index.d.ts', 'index.d.ts.map'])

// note: matches local sibling specifiers — `from './x'`, `import './x'`, `import('./x')` — in a surviving `index.d.ts`.
const SIBLING_SPECIFIER_RE = /(?:from|import\s*\(?)\s*['"]\.\/([^'"]+)['"]/g

const entryDirOf = (entry: EntryPoint, context: BuildContext): string =>
  entry.isRoot ? context.outputPath : join(context.outputPath, entry.srcPath)

const isInDependenciesRoot = (path: string, depsRoot: string): boolean => path === depsRoot || path.startsWith(`${depsRoot}/`)

/**
 * Reads the surviving `index.d.ts` in `dirPath` and returns the set of
 * per-source `.d.ts` / `.d.ts.map` filenames it still re-exports from. These
 * MUST be kept: when the per-entry flatten pass ran, `index.d.ts` is
 * self-contained and this set is empty, so every orphan is removed as before;
 * when the flatten was skipped (e.g., a workspace-only build before the gate
 * fix, or a package with no bundled deps at all), the set keeps the siblings
 * the public entry still points at so the shipped types resolve.
 *
 * Errs toward keeping — a broad specifier match over-keeps (harmless tarball
 * bytes) rather than under-keeps (a dangling `from './x'` in shipped types).
 * Only direct-child references count; nested specifiers (`./sub/x`) belong to
 * another entry directory and the non-recursive prune never touches them.
 *
 * @param dirPath - Absolute path to the entry directory whose `index.d.ts` is read.
 * @returns Set of `.d.ts` / `.d.ts.map` filenames the entry still references.
 */
const referencedSiblingNames = (dirPath: string): ReturnType<typeof createSet<string>> => {
  const names = createSet<string>([])
  const content = readFileIfExists(join(dirPath, INDEX_DTS_NAME))
  if (!content) return names
  for (const match of content.matchAll(SIBLING_SPECIFIER_RE)) {
    const rel = match[1]
    if (!rel || rel.includes('/')) continue
    names.add(`${rel}.d.ts`)
    names.add(`${rel}.d.ts.map`)
  }
  return names
}

const pruneOrphansInDir = (dirPath: string): number => {
  if (!exists(dirPath) || !isDirectory(dirPath)) return 0
  const referenced = referencedSiblingNames(dirPath)
  let removed = 0
  for (const entry of readDirectory(dirPath)) {
    if (!entry.isFile) continue
    if (!ORPHAN_DTS_RE.test(entry.name)) continue
    if (ALWAYS_KEEP.has(entry.name)) continue
    if (referenced.has(entry.name)) continue
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
 * actual public types surface.
 *
 * Safety rails:
 * - Only walks directories that correspond to a discovered entry point.
 * - Never recurses; sibling entry directories are visited individually.
 * - Skips anything inside `_dependencies/` so bundled-dep type pre-pass output
 *   is preserved.
 * - Never deletes a sibling `.d.ts` the surviving `index.d.ts` still re-exports
 *   from. Invariant: after this runs, no public `index.d.ts` references a
 *   removed sibling. When the per-entry flatten pass inlined the siblings, none
 *   are referenced and all are pruned; when the flatten was skipped, the
 *   referenced siblings are kept so the shipped types still resolve.
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
