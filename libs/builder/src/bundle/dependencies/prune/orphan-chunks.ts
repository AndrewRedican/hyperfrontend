import type { BuildContext } from '../../../models'
import { statSync, unlinkSync } from 'node:fs'
import { exists, isDirectory, join, readDirectory } from '@hyperfrontend/project-scope/core'
import { removeEmptyDirs } from '../../fs/empty-dirs'
import { entryDirOf } from '../../fs/entry-dir'
import { isUnderDir } from '../../fs/under-dir'
import { computeReachable } from './reachability'

/**
 * Outcome of the Orphan Sweep.
 */
export interface OrphanPruneResult {
  /** Number of files unlinked (chunks plus their `.map` siblings). */
  orphanFilesRemoved: number
  /** Total bytes reclaimed by the unlinked files. */
  bytesRemoved: number
}

/**
 * Resolves the package's own entry output files for the given file names,
 * skipping any entry directory that resolves at or under `_dependencies/`.
 *
 * These are the reachability/usage roots: the chunks a consumer's package entry
 * points actually load, from which dependency code is reached.
 *
 * @param context - Resolved build context supplying the entry points.
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @param fileNames - Output file names to look for in each entry directory
 * (e.g. `['index.esm.js']`).
 * @returns Absolute paths of every entry file that exists on disk.
 *
 * @example Collecting ESM entry roots
 * ```typescript
 * const roots = collectEntryFiles(context, depsRoot, ['index.esm.js'])
 * ```
 */
export const collectEntryFiles = (context: BuildContext, depsRoot: string, fileNames: string[]): string[] => {
  const files: string[] = []
  for (const entry of context.entryPointDiscovery.entryPoints) {
    const dir = entryDirOf(entry, context)
    if (isUnderDir(dir, depsRoot)) continue
    for (const name of fileNames) {
      const candidate = join(dir, name)
      if (exists(candidate)) files.push(candidate)
    }
  }
  return files
}

/**
 * Recursively collects file paths under `dir` whose base name satisfies
 * `matches`, appending them to `acc`.
 *
 * @param dir - Directory to walk; assumed to exist (the `_dependencies/` root or
 * a directory yielded by `readDirectory`).
 * @param matches - Predicate over a file's base name.
 * @param acc - Accumulator that receives every matching absolute path.
 *
 * @example Gathering every ESM chunk
 * ```typescript
 * const chunks: string[] = []
 * walkFiles(depsRoot, (name) => name === 'index.esm.js', chunks)
 * ```
 */
export const walkFiles = (dir: string, matches: (name: string) => boolean, acc: string[]): void => {
  // why: only ever called on the validated `_dependencies/` root or a directory from `readDirectory`, so the target always exists — no existence guard needed.
  for (const entry of readDirectory(dir)) {
    if (entry.isDirectory) walkFiles(entry.path, matches, acc)
    else if (matches(entry.name)) acc.push(entry.path)
  }
}

const unlinkWithMap = (path: string): OrphanPruneResult => {
  // why: the caller only passes paths it just enumerated from disk, so statSync never misses.
  let bytesRemoved = statSync(path).size
  let orphanFilesRemoved = 1
  unlinkSync(path)
  const mapPath = `${path}.map`
  if (exists(mapPath)) {
    bytesRemoved += statSync(mapPath).size
    unlinkSync(mapPath)
    orphanFilesRemoved += 1
  }
  return { orphanFilesRemoved, bytesRemoved }
}

const pruneJsOrphans = (context: BuildContext, depsRoot: string): OrphanPruneResult => {
  const roots = collectEntryFiles(context, depsRoot, ['index.esm.js', 'index.cjs.js'])
  const reachable = computeReachable(roots, depsRoot)
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === 'index.esm.js' || name === 'index.cjs.js', chunks)
  // why: a dynamic-specifier bail keeps every chunk.
  if (reachable === null) return { orphanFilesRemoved: 0, bytesRemoved: 0 }
  let orphanFilesRemoved = 0
  let bytesRemoved = 0
  for (const chunk of chunks) {
    if (reachable.has(chunk)) continue
    const removed = unlinkWithMap(chunk)
    orphanFilesRemoved += removed.orphanFilesRemoved
    bytesRemoved += removed.bytesRemoved
  }
  return { orphanFilesRemoved, bytesRemoved }
}

// why: declaration specifiers carry the runtime extension (`'.../index.js'`, also `.esm.js`/`.cjs.js`); a d.ts type-reference resolves to the sibling `index.d.ts`, so the type-graph walk must rewrite the target before visiting it.
const toDtsTarget = (target: string): string => target.replace(/(?:\.esm|\.cjs)?\.[mc]?js$/, '.d.ts')

const pruneDtsOrphans = (context: BuildContext, depsRoot: string): OrphanPruneResult => {
  const roots = collectEntryFiles(context, depsRoot, ['index.d.ts'])
  const reachable = computeReachable(roots, depsRoot, toDtsTarget)
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === 'index.d.ts', chunks)
  // why: a dynamic specifier in the type graph cannot be resolved — keep every dep d.ts (guaranteed-safe fallback), mirroring the JS sweep.
  if (reachable === null) return { orphanFilesRemoved: 0, bytesRemoved: 0 }
  let orphanFilesRemoved = 0
  let bytesRemoved = 0
  for (const chunk of chunks) {
    // why: keep a dep's types only when an entry's own d.ts type-graph reaches them — the dts-per-entry pass makes each entry `index.d.ts` self-contained, so any dep d.ts no entry type-graph references is dead.
    if (reachable.has(chunk)) continue
    const removed = unlinkWithMap(chunk)
    orphanFilesRemoved += removed.orphanFilesRemoved
    bytesRemoved += removed.bytesRemoved
  }
  return { orphanFilesRemoved, bytesRemoved }
}

/**
 * Orphan Sweep: deletes `_dependencies/**` chunk files that no package entry
 * reaches.
 *
 * Runs reachability from the package's own entry output chunks over the
 * `_dependencies/` JS graph, unlinks every `index.{esm,cjs}.js` (and `.map`
 * sibling) that is unreachable, then applies the d.ts retention rule — a dep's
 * `index.d.ts` is kept only when it is reachable from an entry's `.d.ts` graph.
 * Entry `index.d.ts` are self-contained (dts-per-entry), so dep types no entry
 * type-graph references are dead and removed. Empty directories left behind are
 * removed. A dynamic, non-literal `import(`/`require(` anywhere in the reachable
 * graph disables deletion entirely (guaranteed-safe fallback).
 *
 * @param context - Resolved build context.
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Aggregate count of files removed and bytes reclaimed.
 *
 * @example Sweeping orphans after the per-entry d.ts pass
 * ```typescript
 * const { orphanFilesRemoved } = pruneOrphanChunks(context, join(context.outputPath, '_dependencies'))
 * ```
 */
export const pruneOrphanChunks = (context: BuildContext, depsRoot: string): OrphanPruneResult => {
  if (!exists(depsRoot) || !isDirectory(depsRoot)) return { orphanFilesRemoved: 0, bytesRemoved: 0 }
  const js = pruneJsOrphans(context, depsRoot)
  const dts = pruneDtsOrphans(context, depsRoot)
  // why: shares the package-wide empty-dir helper; `depsRoot` itself is left intact, matching the prior `cleanupEmptyDirs` behavior.
  removeEmptyDirs(depsRoot)
  return {
    orphanFilesRemoved: js.orphanFilesRemoved + dts.orphanFilesRemoved,
    bytesRemoved: js.bytesRemoved + dts.bytesRemoved,
  }
}
