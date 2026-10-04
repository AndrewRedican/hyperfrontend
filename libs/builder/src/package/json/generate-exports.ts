import type { ConditionalExport, EntryPointDiscovery, ExportValue, FormatOutputs, PackageJson } from '../../models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Internal representation of a single conditional `exports` entry.
 */
interface ExportEntry {
  /** Path to TypeScript declarations. */
  types?: string
  /** Path used by ESM `import`. */
  import?: string
  /** Path used by CommonJS `require`. */
  require?: string
}

const createExportEntry = (outputDir: string, hasEsm: boolean, hasCjs: boolean): ExportEntry => {
  const prefix = outputDir ? `./${outputDir}` : '.'
  const entry: ExportEntry = { types: `${prefix}/index.d.ts` }
  if (hasEsm) entry.import = `${prefix}/index.esm.js`
  if (hasCjs) entry.require = `${prefix}/index.cjs.js`
  return entry
}

const extractOutputDirFromSourcePath = (srcPath: ExportValue): string | null => {
  const path =
    typeof srcPath === 'string'
      ? srcPath
      : ((srcPath as ConditionalExport).import ?? (srcPath as ConditionalExport).require ?? (srcPath as ConditionalExport).default)
  // why: a nested conditional (`{ import: { types, default } }`) or a value with none of import/require/default names no single source module.
  if (typeof path !== 'string') return null

  const subDirMatch = path.match(/^\.\/src\/(.+?)\/index\.[jt]s$/)
  if (subDirMatch && subDirMatch[1]) return subDirMatch[1]

  // why: only `./src/index.[jt]s` names the root entry; any other path has no built counterpart and is reported rather than aliased to the root module.
  return path.match(/^\.\/src\/index\.[jt]s$/) ? '' : null
}

const describeUnmappable = (exportKey: string, srcPath: ExportValue): string =>
  `  "${exportKey}": ${stringify(srcPath)} is not an entry module. Only ./src/index.ts and ./src/<dir>/index.ts (or their .js spelling) are published; move the module into its own directory's index.ts and declare that path.`

const describeUnbuilt = (exportKey: string, outputDir: string): string =>
  `  "${exportKey}": entry ./src/${outputDir ? `${outputDir}/` : ''}index.ts produced no ESM or CJS output. Discovery did not find it (it must be an index.ts at most three directories below src/), or an entry/exclude pattern removed it from every ESM and CJS build.`

/**
 * Generates the published `exports` field by aligning the source `package.json`
 * declaration with the actual format outputs the bundle phase produced.
 *
 * Strategy is **source-exports first**: every key declared on `srcPkg.exports`
 * is mapped to a conditional export entry built from the formats that actually
 * landed for the matching subpath. Internal modules that were built but not
 * advertised in the source `exports` map are intentionally omitted from the
 * published output.
 *
 * A declared key the build cannot publish fails the build instead of being
 * dropped: its source path must be `./src/index.[jt]s` or
 * `./src/<dir>/index.[jt]s` (read from the `import`, `require` or `default`
 * condition of a conditional value), and that entry must have landed as ESM
 * or CJS output.
 *
 * If `srcPkg` has no `exports` field, falls back to a single root-entry export
 * synthesized from `discovery.hasRootEntry`.
 *
 * IIFE / UMD CDN bundles are **not** advertised in `exports`; they are reached
 * solely through the `unpkg`/`jsdelivr` fields (see {@link getCdnPaths}).
 *
 * @param discovery - Entry-point discovery result produced earlier in the pipeline.
 * @param formatOutputs - Aggregated outputs collected by the bundle phase.
 * @param srcPkg - Source `package.json` whose `exports` map drives advertised subpaths.
 * @returns A new `exports` map suitable for the published `package.json`.
 * @throws {Error} When any declared key is not an entry module or its entry produced no ESM or CJS output; every such key is listed.
 *
 * @example Generating exports honoring source aliases
 * ```typescript
 * const exports = generateExportsFromFormats(discovery, formatOutputs, srcPkg)
 * ```
 */
export const generateExportsFromFormats = (
  discovery: EntryPointDiscovery,
  formatOutputs: FormatOutputs,
  srcPkg?: PackageJson
): Record<string, ExportValue> => {
  const exportsMap: Record<string, ExportValue> = { './package.json': './package.json' }

  const esmPaths = createSet(formatOutputs.esm.map((e) => e.exportPath))
  const cjsPaths = createSet(formatOutputs.cjs.map((e) => e.exportPath))

  const srcExports = srcPkg?.exports
  if (srcExports && typeof srcExports === 'object') {
    const unpublishable: string[] = []
    for (const [exportKey, srcPath] of entries(srcExports)) {
      if (exportKey === './package.json') continue

      const outputDir = extractOutputDirFromSourcePath(srcPath)
      if (outputDir === null) {
        unpublishable.push(describeUnmappable(exportKey, srcPath))
        continue
      }
      const discoveryPath = outputDir ? `./${outputDir}` : '.'
      const hasEsm = esmPaths.has(discoveryPath)
      const hasCjs = cjsPaths.has(discoveryPath)

      if (hasEsm || hasCjs) {
        exportsMap[exportKey] = createExportEntry(outputDir, hasEsm, hasCjs)
      } else {
        unpublishable.push(describeUnbuilt(exportKey, outputDir))
      }
    }
    if (unpublishable.length > 0) {
      throw createError(
        `${unpublishable.length} declared export(s) in package.json cannot be published, so consumers importing them would fail:\n${unpublishable.join('\n')}`
      )
    }
  } else if (discovery.hasRootEntry) {
    const hasEsm = esmPaths.has('.')
    const hasCjs = cjsPaths.has('.')
    if (hasEsm || hasCjs) {
      exportsMap['.'] = createExportEntry('', hasEsm, hasCjs)
    }
  }

  return exportsMap
}
