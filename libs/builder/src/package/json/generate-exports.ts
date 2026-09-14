import type { ConditionalExport, EntryPointDiscovery, ExportValue, FormatOutputs, PackageJson } from '../../models'
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
      : ((srcPath as ConditionalExport).import ?? (srcPath as ConditionalExport).require ?? (srcPath as ConditionalExport).default ?? '')

  const subDirMatch = path.match(/^\.\/src\/(.+?)\/index\.[jt]s$/)
  if (subDirMatch && subDirMatch[1]) return subDirMatch[1]

  // why: only the root `./src/index.[jt]s` shape maps onto the root entry; a file export, a path outside src/ or a conditional with no recognised condition has no built counterpart and must be omitted rather than aliased to the root module.
  return path.match(/^\.\/src\/index\.[jt]s$/) ? '' : null
}

/**
 * Generates the published `exports` field by aligning the source `package.json`
 * declaration with the actual format outputs the bundle phase produced.
 *
 * Strategy is **source-exports first**: every key declared on `srcPkg.exports`
 * is mapped to a conditional export entry built from the formats that actually
 * landed for the matching subpath. Internal modules that were built but not
 * advertised in the source `exports` map are intentionally omitted from the
 * published output, and so is a declared key whose source path is not a
 * `./src/<dir>/index.[jt]s` or `./src/index.[jt]s` module (a file export, a
 * path outside `src/`, or a conditional with no recognised condition).
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
    for (const [exportKey, srcPath] of entries(srcExports)) {
      if (exportKey === './package.json') continue

      const outputDir = extractOutputDirFromSourcePath(srcPath)
      if (outputDir === null) continue
      const discoveryPath = outputDir ? `./${outputDir}` : '.'
      const hasEsm = esmPaths.has(discoveryPath)
      const hasCjs = cjsPaths.has(discoveryPath)

      if (hasEsm || hasCjs) {
        exportsMap[exportKey] = createExportEntry(outputDir, hasEsm, hasCjs)
      }
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
