import type {
  BinConfig,
  BinScriptFormat,
  BuildContext,
  FormatOutputs,
  InheritFromSpec,
  IsWorkspacePackagePredicate,
  PackageJson,
} from '../../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { getCdnPaths } from './cdn-paths'
import { filterBundledDepsFromOutput, filterWorkspaceDepsFromOutput } from './filter-deps'
import { generateExportsFromFormats } from './generate-exports'
import { inheritFields } from './inherit-fields'

/**
 * Options consumed by {@link synthesizePackageJson}.
 */
export interface SynthesizePackageJsonOptions {
  /** Selectively copy fields from another `package.json` onto the output. */
  inheritFieldsFrom?: InheritFromSpec
  /** Strip workspace-internal entries from the output `dependencies` map. */
  filterWorkspaceDepsFromOutput?: boolean
  /** Predicate identifying workspace-internal packages; required when filtering is enabled. */
  isWorkspacePackage?: IsWorkspacePackagePredicate
  /** Override path for the `unpkg` field. */
  unpkg?: string
  /** Override path for the `jsdelivr` field. */
  jsdelivr?: string
  /** Bin declarations from the build config; drives `package.json#bin` synthesis. */
  bins?: BinConfig[]
  /** Allowlist for `package.json#files`; emitted verbatim when non-empty. */
  files?: string[]
}

const normalizeFormats = (format: BinConfig['format']): BinScriptFormat[] =>
  isArray(format) ? <BinScriptFormat[]>format : [<BinScriptFormat>format]

const resolveBinRelativePath = (name: string, formats: BinScriptFormat[]): string => {
  if (formats.includes('cjs')) {
    return formats.length === 1 ? `./bin/${name}.js` : `./bin/${name}.cjs.js`
  }
  return `./bin/${name}.mjs`
}

const synthesizeBinField = (bins: BinConfig[] | undefined): Record<string, string> | undefined => {
  if (!bins || bins.length === 0) return undefined
  const next: Record<string, string> = {}
  for (const bin of bins) {
    const formats = normalizeFormats(bin.format)
    if (formats.length === 0) continue
    next[bin.name] = resolveBinRelativePath(bin.name, formats)
  }
  return keys(next).length > 0 ? next : undefined
}

/**
 * Composes the published `package.json` from the source manifest, the bundle-phase
 * outputs, and caller-supplied options.
 *
 * Pipeline order is: filter workspace deps → apply inherited fields → assemble
 * the new manifest with `sideEffects: false`, the regenerated `exports` map, and
 * resolved `main` / `module` / `types` pointers; CDN fields are appended only
 * when a UMD or IIFE bundle was emitted; the `bin` field is synthesized from
 * the supplied bin declarations using deterministic naming rules; the `files`
 * allowlist is forwarded verbatim when supplied.
 *
 * Root-pointers (`main`, `module`, `types`) are removed entirely when the
 * library has no root entry, so consumers cannot resolve a non-existent default.
 *
 * @param srcPkg - Source `package.json` parsed from the project root.
 * @param ctx - Resolved build context (used for the entry-point discovery shape).
 * @param formatOutputs - Aggregated outputs collected by the bundle phase.
 * @param opts - Inheritance / filter / CDN-override / bin / files toggles.
 * @returns The fully assembled `PackageJson` ready to be written to the dist root.
 *
 * @example Synthesizing the dist package.json for a library with workspace inlining
 * ```typescript
 * const distPkg = synthesizePackageJson(srcPkg, ctx, formatOutputs, {
 *   inheritFieldsFrom: { from: '/abs/repo/package.json', fields: ['repository', 'bugs'] },
 *   filterWorkspaceDepsFromOutput: true,
 *   isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
 *   bins: [{ name: 'hf-build', format: ['cjs'] }],
 *   files: ['_dependencies/', 'bin/', 'index.*'],
 * })
 * ```
 */
export const synthesizePackageJson = (
  srcPkg: PackageJson,
  ctx: BuildContext,
  formatOutputs: FormatOutputs,
  opts?: SynthesizePackageJsonOptions
): PackageJson => {
  const workspaceFiltered =
    opts?.filterWorkspaceDepsFromOutput && opts.isWorkspacePackage ? filterWorkspaceDepsFromOutput(srcPkg, opts.isWorkspacePackage) : srcPkg

  const filtered = filterBundledDepsFromOutput(workspaceFiltered, ctx.bundledDeps)

  const inherited = inheritFields(filtered, opts?.inheritFieldsFrom)
  const exportsMap = generateExportsFromFormats(ctx.entryPointDiscovery, formatOutputs, srcPkg)

  const distPkg: PackageJson = {
    ...inherited,
    sideEffects: false,
    exports: exportsMap,
  }

  const hasEsm = formatOutputs.esm.some((e) => e.isRoot)
  const hasCjs = formatOutputs.cjs.some((e) => e.isRoot)

  if (ctx.entryPointDiscovery.hasRootEntry && (hasEsm || hasCjs)) {
    if (hasCjs) distPkg.main = './index.cjs.js'
    if (hasEsm) distPkg.module = './index.esm.js'
    distPkg.types = './index.d.ts'
  } else {
    delete distPkg.main
    delete distPkg.module
    delete distPkg.types
  }

  const cdn = getCdnPaths(formatOutputs, { unpkg: opts?.unpkg, jsdelivr: opts?.jsdelivr })
  if (cdn) {
    distPkg.unpkg = cdn.unpkg
    distPkg.jsdelivr = cdn.jsdelivr
  }

  const bin = synthesizeBinField(opts?.bins)
  if (bin) {
    distPkg.bin = bin
  } else {
    delete distPkg.bin
  }

  if (opts?.files && opts.files.length > 0) {
    distPkg.files = [...opts.files]
  }

  return distPkg
}
