import type { BuildContext, FormatOutputs, InheritFromSpec, IsWorkspacePackagePredicate, PackageJson } from '../../models'
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
}

/**
 * Composes the published `package.json` from the source manifest, the bundle-phase
 * outputs, and caller-supplied options.
 *
 * Pipeline order is: filter workspace deps → apply inherited fields → assemble
 * the new manifest with `sideEffects: false`, the regenerated `exports` map, and
 * resolved `main` / `module` / `types` pointers; CDN fields are appended only
 * when a UMD or IIFE bundle was emitted.
 *
 * Root-pointers (`main`, `module`, `types`) are removed entirely when the
 * library has no root entry, so consumers cannot resolve a non-existent default.
 *
 * @param srcPkg - Source `package.json` parsed from the project root.
 * @param ctx - Resolved build context (used for the entry-point discovery shape).
 * @param formatOutputs - Aggregated outputs collected by the bundle phase.
 * @param opts - Inheritance / filter / CDN-override toggles.
 * @returns The fully assembled `PackageJson` ready to be written to the dist root.
 *
 * @example Synthesizing the dist package.json for a library with workspace inlining
 * ```typescript
 * const distPkg = synthesizePackageJson(srcPkg, ctx, formatOutputs, {
 *   inheritFieldsFrom: { from: '/abs/repo/package.json', fields: ['repository', 'bugs'] },
 *   filterWorkspaceDepsFromOutput: true,
 *   isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
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

  return distPkg
}
