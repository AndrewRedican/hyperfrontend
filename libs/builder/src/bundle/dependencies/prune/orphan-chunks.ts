import type { BuildContext, EntryPoint } from '../../../models'
import { rmdirSync, statSync, unlinkSync } from 'node:fs'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, getDirname, isDirectory, join, readDirectory } from '@hyperfrontend/project-scope/core'
import { computeReachable } from './reachability'

/**
 * Outcome of the Tier-1 orphan-chunk sweep.
 */
export interface OrphanPruneResult {
  /** Number of files unlinked (chunks plus their `.map` siblings). */
  orphanFilesRemoved: number
  /** Total bytes reclaimed by the unlinked files. */
  bytesRemoved: number
}

const entryDirOf = (entry: EntryPoint, context: BuildContext): string =>
  entry.isRoot ? context.outputPath : join(context.outputPath, entry.srcPath)

const isUnderRoot = (path: string, depsRoot: string): boolean => path === depsRoot || path.startsWith(`${depsRoot}/`)

const collectEntryFiles = (context: BuildContext, depsRoot: string, fileNames: string[]): string[] => {
  const files: string[] = []
  for (const entry of context.entryPointDiscovery.entryPoints) {
    const dir = entryDirOf(entry, context)
    if (isUnderRoot(dir, depsRoot)) continue
    for (const name of fileNames) {
      const candidate = join(dir, name)
      if (exists(candidate)) files.push(candidate)
    }
  }
  return files
}

// why: only ever called on the validated `_dependencies/` root or a directory from `readDirectory`, so the target always exists — no existence guard needed.
const walkFiles = (dir: string, matches: (name: string) => boolean, acc: string[]): void => {
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

const removeEmptyDirsRecursive = (dir: string): void => {
  for (const entry of readDirectory(dir)) {
    if (entry.isDirectory) removeEmptyDirsRecursive(entry.path)
  }
  if (readDirectory(dir).length === 0) rmdirSync(dir)
}

// why: invoked only after `pruneOrphanChunks` has validated `depsRoot`, so it always exists.
const cleanupEmptyDirs = (depsRoot: string): void => {
  for (const entry of readDirectory(depsRoot)) {
    if (entry.isDirectory) removeEmptyDirsRecursive(entry.path)
  }
}

/**
 * Outcome of the Tier-1 JS orphan-chunk sweep.
 */
interface JsSweep {
  /** Files removed and bytes reclaimed by the JS sweep. */
  result: OrphanPruneResult
  /** Directories whose `index.esm.js` or `index.cjs.js` sibling survived the sweep. */
  survivedDirs: Set<string>
}

const pruneJsOrphans = (context: BuildContext, depsRoot: string): JsSweep => {
  const roots = collectEntryFiles(context, depsRoot, ['index.esm.js', 'index.cjs.js'])
  const reachable = computeReachable(roots, depsRoot)
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === 'index.esm.js' || name === 'index.cjs.js', chunks)
  const survivedDirs = createSet<string>([])
  // why: a dynamic-specifier bail keeps every chunk; mark all dirs survived so d.ts retention keeps its co-located types too.
  if (reachable === null) {
    for (const chunk of chunks) survivedDirs.add(getDirname(chunk))
    return { result: { orphanFilesRemoved: 0, bytesRemoved: 0 }, survivedDirs }
  }
  let orphanFilesRemoved = 0
  let bytesRemoved = 0
  for (const chunk of chunks) {
    if (reachable.has(chunk)) {
      survivedDirs.add(getDirname(chunk))
      continue
    }
    const removed = unlinkWithMap(chunk)
    orphanFilesRemoved += removed.orphanFilesRemoved
    bytesRemoved += removed.bytesRemoved
  }
  return { result: { orphanFilesRemoved, bytesRemoved }, survivedDirs }
}

const pruneDtsOrphans = (context: BuildContext, depsRoot: string, survivedDirs: Set<string>): OrphanPruneResult => {
  const roots = collectEntryFiles(context, depsRoot, ['index.d.ts'])
  const reachable = computeReachable(roots, depsRoot)
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === 'index.d.ts', chunks)
  let orphanFilesRemoved = 0
  let bytesRemoved = 0
  for (const chunk of chunks) {
    const reachableFromDts = reachable !== null && reachable.has(chunk)
    // why: retention OR-rule — keep a dep's types when its own d.ts graph reaches them OR its runtime sibling survived.
    if (reachableFromDts || survivedDirs.has(getDirname(chunk))) continue
    const removed = unlinkWithMap(chunk)
    orphanFilesRemoved += removed.orphanFilesRemoved
    bytesRemoved += removed.bytesRemoved
  }
  return { orphanFilesRemoved, bytesRemoved }
}

/**
 * Tier-1 orphan-chunk sweep: deletes `_dependencies/**` chunk files that no
 * package entry reaches.
 *
 * Runs reachability from the package's own entry output chunks over the
 * `_dependencies/` JS graph, unlinks every `index.{esm,cjs}.js` (and `.map`
 * sibling) that is unreachable, then applies the d.ts retention rule — a dep's
 * `index.d.ts` is kept when it is reachable from an entry's `.d.ts` graph or its
 * runtime sibling survived the JS sweep. Empty directories left behind are
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
  const dts = pruneDtsOrphans(context, depsRoot, js.survivedDirs)
  cleanupEmptyDirs(depsRoot)
  return {
    orphanFilesRemoved: js.result.orphanFilesRemoved + dts.orphanFilesRemoved,
    bytesRemoved: js.result.bytesRemoved + dts.bytesRemoved,
  }
}
