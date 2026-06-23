import type { BuildContext } from '../../../models'
import type { ChunkFormat, ImportUsage } from './used-exports'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, getDirname, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core'
import { stripDeadExports } from './dead-exports'
import { collectEntryFiles, walkFiles } from './orphan-chunks'
import { collectImportEdges } from './used-exports'

const log = logger.channel('builder:bundle:dependencies:prune')

// why: the strip → re-derive → strip cycle converges in passes bounded by the chunk-import depth; this cap is a runaway guard, logged if ever reached.
const MAX_ITERATIONS = 50

/**
 * A module format paired with the chunk file name that materializes it under
 * `_dependencies/`.
 */
interface FormatTarget {
  /** Module format whose chunks are stripped. */
  format: ChunkFormat
  /** Per-chunk output file name for the format. */
  fileName: string
}

const FORMAT_FILES: ReadonlyArray<FormatTarget> = [
  { format: 'esm', fileName: 'index.esm.js' },
  { format: 'cjs', fileName: 'index.cjs.js' },
]

/**
 * Aggregate result of the dead-export stripping pass.
 */
export interface DeadExportPassResult {
  /** Exported declarations spliced out across all chunks and iterations. */
  deadExportsRemoved: number
  /** Bytes reclaimed by shrinking chunk sources. */
  bytesRemoved: number
}

const mergeUsage = (usageMap: Map<string, ImportUsage>, target: string, usage: ImportUsage): void => {
  const current = usageMap.get(target)
  // why: targets outside the surviving-chunk set are the package's own code — not strippable, so ignore their demand.
  if (current === undefined || current === 'all') return
  if (usage === 'all') {
    usageMap.set(target, 'all')
    return
  }
  for (const name of usage) current.add(name)
}

const buildUsageMap = (importers: string[], chunks: string[], format: ChunkFormat): Map<string, ImportUsage> => {
  const usageMap = createMap<string, ImportUsage>()
  for (const chunk of chunks) usageMap.set(chunk, createSet<string>([]))
  // why: every importer is either a validated entry file or a chunk just walked off disk, so all are present — no existence guard needed.
  for (const importer of importers) {
    for (const [target, usage] of collectImportEdges(readFileContent(importer), getDirname(importer), format))
      mergeUsage(usageMap, target, usage)
  }
  return usageMap
}

const stripChunks = (usageMap: Map<string, ImportUsage>, format: ChunkFormat, result: DeadExportPassResult): boolean => {
  let changed = false
  for (const [chunk, keep] of usageMap) {
    const source = readFileContent(chunk)
    const stripped = stripDeadExports(source, format, keep)
    if (!stripped) continue
    writeFileContent(chunk, stripped.code)
    result.deadExportsRemoved += stripped.removedNames.length
    result.bytesRemoved += Buffer.byteLength(source) - Buffer.byteLength(stripped.code)
    changed = true
  }
  return changed
}

const processFormat = (
  context: BuildContext,
  depsRoot: string,
  format: ChunkFormat,
  fileName: string,
  result: DeadExportPassResult
): void => {
  const entries = collectEntryFiles(context, depsRoot, [fileName])
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const chunks: string[] = []
    walkFiles(depsRoot, (name) => name === fileName, chunks)
    if (chunks.length === 0) return
    const usageMap = buildUsageMap([...entries, ...chunks], chunks, format)
    if (!stripChunks(usageMap, format, result)) return
    // istanbul ignore next -- why: convergence exits via the early return above; a >50-deep chunk import chain that would exhaust the cap cannot occur in bundled dependency output, so the guard log is unreachable in practice.
    if (iteration === MAX_ITERATIONS - 1)
      log.warn(`dead-export strip for ${format} hit the ${MAX_ITERATIONS}-iteration cap before converging`)
  }
}

/**
 * Shrinks surviving `_dependencies/` chunks by stripping dead exported
 * declarations, iterating to a fixpoint per format.
 *
 * Each iteration re-derives the importer demand for every surviving chunk from
 * the current on-disk sources (entries plus sibling chunks), strips each chunk
 * to that demand, and repeats until no chunk changes — because removing one
 * chunk's import can make another chunk's export dead in turn. ESM and CJS are
 * processed independently. The orphan sweep is expected to run afterwards to
 * reclaim any chunk whose last import was removed here.
 *
 * @param context - Resolved build context supplying the entry points.
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Counts of exports removed and bytes reclaimed.
 *
 * @example Running the strip pass after the orphan sweep
 * ```typescript
 * const { deadExportsRemoved } = stripDeadExportsPass(context, depsRootOf(context))
 * ```
 */
export const stripDeadExportsPass = (context: BuildContext, depsRoot: string): DeadExportPassResult => {
  const result: DeadExportPassResult = { deadExportsRemoved: 0, bytesRemoved: 0 }
  if (!exists(depsRoot)) return result
  for (const { format, fileName } of FORMAT_FILES) processFormat(context, depsRoot, format, fileName, result)
  return result
}
