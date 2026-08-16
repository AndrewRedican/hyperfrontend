import type { BuildContext } from '../../models'
import { unlinkSync } from 'node:fs'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, getDirname, join, readDirectory, readFileContent } from '@hyperfrontend/project-scope/core'
import { collectChunkSpecifiers, hasDynamicSpecifier } from '../dependencies/prune/specifiers'
import { depsRootOf } from '../fs/deps-root'
import { entryDirOf } from '../fs/entry-dir'
import { isUnderDir } from '../fs/under-dir'

const log = logger.channel('builder:bundle:declarations:prune-orphans')

const ORPHAN_DTS_RE = /\.d\.ts$|\.d\.ts\.map$/
const INDEX_DTS_NAME = 'index.d.ts'

/**
 * Resolves a relative specifier found in a `.d.ts` to the absolute `.d.ts` file
 * it points at, or `null` when it resolves to nothing on disk or into
 * `_dependencies/`.
 *
 * Declaration specifiers are extensionless (`./create-logger`, `./shared/consts`)
 * or directory imports (`./shared` → `shared/index.d.ts`); the canonical
 * `_dependencies` routing uses an explicit runtime extension (`.../index.js`),
 * which is rewritten to its declaration sibling. Targets under `depsRoot` are
 * never edges for this pass: bundled-dep declarations are managed by the
 * dependency Type Prune, and this pass must never touch them.
 *
 * @param dir - Absolute directory of the referencing `.d.ts`.
 * @param spec - Relative specifier text (already known to start with `.`).
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Absolute `.d.ts` path of the referenced sibling, or `null`.
 */
const toDtsTarget = (dir: string, spec: string, depsRoot: string): string | null => {
  const abs = join(dir, spec)
  // why: a `.js` specifier is the bundled-dep routing shape; map it onto its declaration sibling.
  const candidates = spec.endsWith('.js') ? [`${abs.slice(0, -3)}.d.ts`] : [`${abs}.d.ts`, join(abs, INDEX_DTS_NAME)]
  for (const candidate of candidates) {
    if (isUnderDir(candidate, depsRoot)) return null
    if (exists(candidate)) return candidate
  }
  return null
}

/**
 * Computes the set of `.d.ts` files reachable from the entry-point `index.d.ts`
 * roots by transitively following their relative specifiers.
 *
 * Breadth-first: each visited file's text is read, scanned once, then released
 * before the next, so only one declaration source is resident at a time and the
 * memory profile stays flat. Edges into `_dependencies/` and to non-existent
 * targets are dropped. The specifier scan over-approximates (a spurious match
 * over-keeps harmless bytes) so it never under-keeps a referenced sibling.
 *
 * If any reached `.d.ts` contains a dynamic (non-literal) `import(`/`require(`,
 * the graph cannot be fully resolved, so the function returns `null`: the
 * safe sentinel that makes the caller keep every declaration.
 *
 * @param roots - Absolute paths to the entry-point `index.d.ts` roots.
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns The set of reachable absolute `.d.ts` paths, or `null` on a dynamic
 * specifier bail.
 */
const computeReachableDeclarations = (roots: string[], depsRoot: string): Set<string> | null => {
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
    // why: every queued path was `exists`-checked before enqueue (roots and `toDtsTarget` targets), so a direct read is safe.
    const source = readFileContent(file)
    if (hasDynamicSpecifier(source)) {
      log.warn(`dynamic import/require in ${file}; keeping all orphan declarations for safety`)
      return null
    }
    const dir = getDirname(file)
    for (const spec of collectChunkSpecifiers(source)) {
      const target = toDtsTarget(dir, spec, depsRoot)
      if (target !== null && !reachable.has(target)) {
        reachable.add(target)
        queue.push(target)
      }
    }
  }
  return reachable
}

/**
 * Collects every `.d.ts` / `.d.ts.map` file under `root`, recursing the whole
 * package tree but skipping the `_dependencies/` subtree (managed by the
 * dependency Type Prune, never touched here).
 *
 * @param root - Absolute path to the package output root.
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Absolute paths of all declaration files outside `_dependencies/`.
 */
const collectDeclarationFiles = (root: string, depsRoot: string): string[] => {
  const files: string[] = []
  if (!exists(root)) return files
  const visit = (dir: string): void => {
    for (const entry of readDirectory(dir)) {
      if (entry.isDirectory) {
        if (isUnderDir(entry.path, depsRoot)) continue
        visit(entry.path)
      } else if (entry.isFile && ORPHAN_DTS_RE.test(entry.name)) {
        files.push(entry.path)
      }
    }
  }
  visit(root)
  return files
}

/**
 * Removes redundant per-source `.d.ts` / `.d.ts.map` files left behind once the
 * per-entry flatten has inlined each entry's declarations into a self-contained
 * `index.d.ts`.
 *
 * Walks the whole package tree (excluding `_dependencies/`) and deletes every
 * declaration file **not reachable** from an entry-point `index.d.ts` via its
 * transitive relative specifiers. Reachability (rather than a per-directory
 * sweep) guarantees the invariant that after this runs no surviving `.d.ts`
 * references a removed one: when the flatten made `index.d.ts` self-contained
 * the reachable set collapses to the roots and every per-source sibling is
 * pruned; when the flatten was skipped the siblings the public entry still
 * re-exports (and anything they transitively re-export) stay live so the shipped
 * types resolve. This removes the redundancy at the source so `dist` == the
 * shipped tarball, demoting `package.json#files` to a backstop.
 *
 * Safety rails:
 * - Never touches anything inside `_dependencies/`.
 * - A `.d.ts.map` is kept iff its sibling `.d.ts` is reachable.
 * - A dynamic (non-literal) `import(`/`require(` in any reached declaration
 *   aborts the prune and keeps every declaration file.
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
  const depsRoot = depsRootOf(context)
  const roots: string[] = []
  for (const entry of context.entryPointDiscovery.entryPoints) {
    const dir = entryDirOf(entry, context)
    if (isUnderDir(dir, depsRoot)) continue
    roots.push(join(dir, INDEX_DTS_NAME))
  }
  const reachable = computeReachableDeclarations(roots, depsRoot)
  if (reachable === null) return 0
  let total = 0
  for (const file of collectDeclarationFiles(context.outputPath, depsRoot)) {
    // why: a `.d.ts.map` shares the liveness of its `.d.ts` sibling, keyed by stripping the trailing `.map`.
    const dtsKey = file.endsWith('.d.ts.map') ? file.slice(0, -4) : file
    if (reachable.has(dtsKey)) continue
    unlinkSync(file)
    total += 1
  }
  if (total > 0) log.info(`pruned ${total} orphan declaration file(s)`)
  return total
}
