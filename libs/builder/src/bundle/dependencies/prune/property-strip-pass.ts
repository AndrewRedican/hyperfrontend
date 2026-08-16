import type { BuildContext } from '../../../models'
import type { PropDemand } from './namespace-usage'
import type { NamespaceInfo } from './property-strip'
import type { ChunkFormat } from './used-exports'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, getDirname, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core'
import { collectNamespaceUsage, mergeDemand } from './namespace-usage'
import { collectEntryFiles, walkFiles } from './orphan-chunks'
import { analyzeChunkNamespaces, stripDeadProperties } from './property-strip'
import { hasDynamicSpecifier } from './specifiers'

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
 * Aggregate result of the namespace property-strip pass.
 */
export interface PropertyStripPassResult {
  /** Namespace slots removed across all chunks. */
  deadPropertiesRemoved: number
  /** Bytes reclaimed by shrinking namespace literals. */
  bytesRemoved: number
}

// why: a dynamic, non-literal `import(`/`require(` anywhere in the consumer graph means a consumer we cannot resolve might read a namespace wholesale — disable property-strip for the format (guaranteed-safe fallback, mirroring the orphan sweep).
const graphHasDynamicSpecifier = (importers: string[]): boolean =>
  importers.some((importer) => hasDynamicSpecifier(readFileContent(importer)))

const collectChunkNamespaces = (chunks: string[], format: ChunkFormat): Map<string, NamespaceInfo[]> => {
  const byChunk = createMap<string, NamespaceInfo[]>()
  for (const chunk of chunks) {
    const { namespaces } = analyzeChunkNamespaces(readFileContent(chunk), format)
    if (namespaces.length > 0) byChunk.set(chunk, namespaces)
  }
  return byChunk
}

// why: seed each namespace-bearing chunk's demand with the demand its own body imposes, so an internal read or escape is counted before importers are scanned.
const seedSelfDemand = (
  chunks: string[],
  namespacesByChunk: Map<string, NamespaceInfo[]>,
  format: ChunkFormat
): Map<string, Map<string, PropDemand>> => {
  const demand = createMap<string, Map<string, PropDemand>>()
  for (const chunk of chunks) {
    if (!namespacesByChunk.has(chunk)) continue
    const { selfDemand } = analyzeChunkNamespaces(readFileContent(chunk), format)
    demand.set(chunk, selfDemand)
  }
  return demand
}

const accumulateImporterDemand = (
  importers: string[],
  namespacesByChunk: Map<string, NamespaceInfo[]>,
  demand: Map<string, Map<string, PropDemand>>,
  format: ChunkFormat
): void => {
  for (const importer of importers) {
    const edges = collectNamespaceUsage(readFileContent(importer), getDirname(importer), format)
    for (const [target, usage] of edges) {
      const chunkDemand = demand.get(target)
      const namespaces = namespacesByChunk.get(target)
      // why: edges to chunks with no strippable namespace are irrelevant here.
      if (!chunkDemand || !namespaces) continue
      if (usage.bailAll) {
        for (const namespace of namespaces) mergeDemand(chunkDemand, namespace.exported, 'all')
        continue
      }
      for (const [name, propDemand] of usage.perName) mergeDemand(chunkDemand, name, propDemand)
    }
  }
}

// context: the set of property names to retain for each namespace export of one chunk — only namespaces read at a strict, non-empty subset of their slots, so leaving a fully-unread namespace (dead) to the export pass and a wholesale-consumed one untouched.
const keepSetsForChunk = (namespaces: NamespaceInfo[], chunkDemand: Map<string, PropDemand>): Map<string, Set<string>> => {
  const keepByExport = createMap<string, Set<string>>()
  for (const namespace of namespaces) {
    const propDemand = chunkDemand.get(namespace.exported)
    if (propDemand === undefined || propDemand === 'all') continue
    const keep = createSet<string>(namespace.properties.filter((property) => propDemand.has(property)))
    if (keep.size > 0 && keep.size < namespace.properties.length) keepByExport.set(namespace.exported, keep)
  }
  return keepByExport
}

const rewriteChunks = (
  namespacesByChunk: Map<string, NamespaceInfo[]>,
  demand: Map<string, Map<string, PropDemand>>,
  format: ChunkFormat,
  result: PropertyStripPassResult
): void => {
  for (const [chunk, namespaces] of namespacesByChunk) {
    const chunkDemand = demand.get(chunk)
    if (!chunkDemand) continue
    const keepByExport = keepSetsForChunk(namespaces, chunkDemand)
    if (keepByExport.size === 0) continue
    const source = readFileContent(chunk)
    const stripped = stripDeadProperties(source, format, keepByExport)
    if (!stripped) continue
    writeFileContent(chunk, stripped.code)
    result.deadPropertiesRemoved += stripped.removedProperties
    result.bytesRemoved += Buffer.byteLength(source) - Buffer.byteLength(stripped.code)
  }
}

const processFormat = (
  context: BuildContext,
  depsRoot: string,
  format: ChunkFormat,
  fileName: string,
  result: PropertyStripPassResult
): void => {
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === fileName, chunks)
  if (chunks.length === 0) return
  const importers = [...collectEntryFiles(context, depsRoot, [fileName]), ...chunks]
  if (graphHasDynamicSpecifier(importers)) return
  const namespacesByChunk = collectChunkNamespaces(chunks, format)
  if (namespacesByChunk.size === 0) return
  const demand = seedSelfDemand(chunks, namespacesByChunk, format)
  accumulateImporterDemand(importers, namespacesByChunk, demand, format)
  rewriteChunks(namespacesByChunk, demand, format, result)
}

/**
 * Property-level tree-shaking of kept, live frozen namespace objects: drops the
 * slots of an exported `freeze({ … })` namespace that no consumer in the whole
 * graph ever reads, letting the dead-export pass then collapse the now-dead
 * factory bindings.
 *
 * Runs per format (ESM and CJS) over `_dependencies/` chunks. The consumer graph
 * is the package's entry chunks plus every sibling dependency chunk: a complete
 * importer set, since per-entry bundling inlines all other first-party code.
 * Each namespace's demand is the union of its `NS.prop` reads across that graph
 * (in CJS, a two-level `require(...).NS.prop`); a wholesale consumption (spread,
 * pass-through, enumeration, dynamic index, re-export, namespace/default import)
 * or any dynamic specifier in the graph keeps the namespace whole. Only a
 * namespace read at a strict, non-empty subset of its slots is rewritten. The
 * caller is expected to re-run the dead-export pass afterwards to reclaim the
 * orphaned factories.
 *
 * @param context - Resolved build context supplying the entry points.
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Counts of slots removed and bytes reclaimed.
 *
 * @example Running the property strip before the dead-export re-pass
 * ```typescript
 * const { deadPropertiesRemoved } = stripDeadPropertiesPass(context, depsRootOf(context))
 * ```
 */
export const stripDeadPropertiesPass = (context: BuildContext, depsRoot: string): PropertyStripPassResult => {
  const result: PropertyStripPassResult = { deadPropertiesRemoved: 0, bytesRemoved: 0 }
  if (!exists(depsRoot)) return result
  for (const { format, fileName } of FORMAT_FILES) processFormat(context, depsRoot, format, fileName, result)
  return result
}
