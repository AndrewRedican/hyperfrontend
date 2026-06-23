import type { MemoryMonitor } from '../../memory/monitor'
import type { BuildContext } from '../../models'
import type { ChunkFormat } from '../dependencies/prune/used-exports'
import type { OwnerIndex } from './attribute-modules'
import type { ChunkPlan, CrossImport, DepImport } from './extract-chunk'
import type { EntryInput, PlannedModule } from './plan-hoists'
import type { EntryHoist } from './rewrite-entry'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, exists, join, readFileContent, relativePath, writeFileContent } from '@hyperfrontend/project-scope/core'
import { entryDirOf } from '../fs/entry-dir'
import { attribute, chunkFileName, indexOwners, parseEntry, sharedDirFor } from './attribute-modules'
import { renderChunk } from './extract-chunk'
import { planHoists } from './plan-hoists'
import { rewriteEntry } from './rewrite-entry'

const log = logger.channel('builder:bundle:dedupe')

const FORMATS: ReadonlyArray<ChunkFormat> = ['esm', 'cjs']

/**
 * Aggregate result of the shared-first-party hoist pass.
 */
export interface HoistReport {
  /** Number of `_shared/` chunk files written across all formats. */
  chunksWritten: number
  /** Net bytes reclaimed: inlined copies removed minus the shared chunks emitted. */
  bytesReclaimed: number
}

/** One entry point's resolved output directory and bundle file for a format. */
interface EntryLocation {
  /** Absolute entry output directory. */
  dir: string
  /** Absolute entry bundle file. */
  file: string
}

const toSpecifier = (relative: string): string => (relative.startsWith('.') ? relative : `./${relative}`)

const recomputeSpecifier = (specifier: string, fromDir: string, baseDir: string): string =>
  // why: relative `_dependencies`/`_shared` edges move with the chunk; bare and node-builtin specifiers resolve identically from anywhere, so they pass through verbatim.
  specifier.startsWith('.') ? toSpecifier(relativePath(fromDir, join(baseDir, specifier))) : specifier

const locateEntries = (context: BuildContext, format: ChunkFormat): EntryLocation[] => {
  const locations: EntryLocation[] = []
  for (const entry of context.entryPointDiscovery.entryPoints) {
    const dir = entryDirOf(entry, context)
    const file = join(dir, chunkFileName(format))
    if (exists(file)) locations.push({ dir, file })
  }
  return locations
}

const chunkFileFor = (context: BuildContext, moduleKey: string, format: ChunkFormat): string =>
  join(context.outputPath, sharedDirFor(moduleKey), chunkFileName(format))

const buildChunkPlan = (
  planned: PlannedModule,
  context: BuildContext,
  chunkDir: string,
  canonicalDir: string,
  format: ChunkFormat
): ChunkPlan => {
  const crossImports: CrossImport[] = planned.resolution.crossModule.map((ref) => ({
    ref: ref.ref,
    exported: ref.base,
    specifier: toSpecifier(relativePath(chunkDir, chunkFileFor(context, ref.moduleKey, format))),
  }))
  const depImports: DepImport[] = planned.resolution.depImports.map((dep) => ({
    ref: dep.ref,
    kind: dep.binding.kind,
    imported: dep.binding.imported,
    specifier: recomputeSpecifier(dep.binding.specifier, chunkDir, canonicalDir),
  }))
  return { decls: planned.decls, crossImports, depImports }
}

const writeChunks = (
  context: BuildContext,
  plan: Map<string, PlannedModule>,
  locations: EntryLocation[],
  format: ChunkFormat,
  report: HoistReport
): void => {
  for (const [moduleKey, planned] of plan) {
    const chunkDir = join(context.outputPath, sharedDirFor(moduleKey))
    const chunkPlan = buildChunkPlan(planned, context, chunkDir, (<EntryLocation>locations[planned.canonicalEntryIndex]).dir, format)
    const source = renderChunk(chunkPlan, format)
    ensureDir(chunkDir)
    writeFileContent(chunkFileFor(context, moduleKey, format), source)
    report.chunksWritten += 1
    report.bytesReclaimed -= Buffer.byteLength(source)
  }
}

const rewriteEntries = (
  context: BuildContext,
  plan: Map<string, PlannedModule>,
  entries: EntryInput[],
  locations: EntryLocation[],
  format: ChunkFormat,
  report: HoistReport
): void => {
  for (const [index, entry] of entries.entries()) {
    const hoists: EntryHoist[] = []
    for (const [moduleKey] of plan) {
      const decls = entry.byModule.get(moduleKey)
      if (decls === undefined) continue
      hoists.push({
        decls,
        specifier: toSpecifier(relativePath((<EntryLocation>locations[index]).dir, chunkFileFor(context, moduleKey, format))),
      })
      for (const decl of decls) report.bytesReclaimed += Buffer.byteLength(decl.text)
    }
    if (hoists.length > 0) writeFileContent((<EntryLocation>locations[index]).file, rewriteEntry(entry.parsed, hoists, format))
  }
}

const processFormat = (context: BuildContext, owners: OwnerIndex, format: ChunkFormat, report: HoistReport): void => {
  const locations = locateEntries(context, format)
  if (locations.length < 2) return
  const entries: EntryInput[] = locations.map((location) => {
    const parsed = parseEntry(readFileContent((<EntryLocation>location).file), format)
    return { parsed, byModule: attribute(parsed, owners) }
  })
  const plan = planHoists(entries, owners)
  if (plan.size === 0) return
  writeChunks(context, plan, locations, format, report)
  rewriteEntries(context, plan, entries, locations, format, report)
}

/**
 * Lifts first-party modules that are inlined into multiple entry bundles into
 * shared `_shared/<srcPath>/index.<fmt>.js` chunks and rewrites every consuming
 * entry to import them.
 *
 * Runs as an additive post-emit pass over the already-bundled `esm` and `cjs`
 * outputs, each processed independently; `iife`/`umd`/`bin` and `.d.ts` outputs
 * are never read. Per-entry isolated bundling is untouched. Every hoist is
 * proven safe by {@link planHoists} before it happens — structurally identical
 * copies, resolvable references, and cycle-free module-initialization — so any module
 * that cannot be proven safe is left inlined and the output is, worst case,
 * identical to the input.
 *
 * @param context - Resolved build context. `outputPath` locates the bundles and
 * `projectRoot/src` drives ownership attribution.
 * @param monitor - Optional memory monitor; a checkpoint is captured after each
 * format so the pass is observable.
 * @returns Counts of chunks written and net bytes reclaimed.
 *
 * @example Hoisting after the dependency prune
 * ```typescript
 * const report = hoistSharedFirstParty(context, monitor)
 * ```
 */
export const hoistSharedFirstParty = (context: BuildContext, monitor?: MemoryMonitor): HoistReport => {
  const report: HoistReport = { chunksWritten: 0, bytesReclaimed: 0 }
  const srcRoot = join(context.projectRoot, 'src')
  if (!exists(srcRoot)) return report
  const owners = indexOwners(srcRoot)
  for (const format of FORMATS) {
    processFormat(context, owners, format, report)
    monitor?.check(`bundle:dedupe:shared-first-party:${format}:end`)
  }
  if (report.chunksWritten > 0) log.info(`hoisted ${report.chunksWritten} shared chunk(s), reclaimed ${report.bytesReclaimed} byte(s)`)
  return report
}
