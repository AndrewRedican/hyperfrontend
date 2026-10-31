import type { BuildConfig, BuildContext, FormatOutputs } from '../models'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { copyAssets } from './assets/copy-assets'
import { readProjectPackageJson } from './json/read-package-json'
import { synthesizePackageJson } from './json/synthesize'
import { writeOutputPackageJson } from './json/write'
import { collectThirdPartyLicenses } from './licenses/collect'
import { collectBundledThirdPartyLicenses } from './licenses/collect-bundled'
import { generateThirdPartyLicensesContent } from './licenses/generate-content'
import { writeThirdPartyLicensesFile } from './licenses/write'

/**
 * Runs the complete package phase: synthesizes and writes the dist
 * `package.json`, materializes any configured asset specs, and (when
 * `config.thirdPartyLicenses` is enabled, defaulting to `true` for builds
 * that inline third-party code) emits `THIRD_PARTY_LICENSES.md`.
 *
 * The license file lists the published `dependencies` plus every third-party
 * package the output inlines: bundled dependencies, their transitive
 * dependencies, and the dependencies of inlined workspace packages, each with
 * its license and notice texts.
 *
 * The phase consumes:
 * - the source `package.json` (read fresh from `ctx.projectRoot`)
 * - the resolved {@link BuildContext} (output path, workspace predicate, assets, discovery)
 * - the {@link FormatOutputs} aggregated by the bundle phase
 *
 * Workspace-internal entries are stripped from the published `dependencies`
 * map only when both `config.filterWorkspaceDepsFromOutput` and
 * `ctx.isWorkspacePackage` are present. Inheritance and CDN overrides are
 * forwarded verbatim to {@link synthesizePackageJson}.
 *
 * @param ctx - Resolved build context.
 * @param config - Top-level builder configuration. Reads `inheritFieldsFrom`,
 * `filterWorkspaceDepsFromOutput`, `unpkg`, `jsdelivr`, `bin`, and `thirdPartyLicenses`.
 * The `files` allowlist is owned by {@link finalizeFilesAllowlist}, not this phase.
 * @param formatOutputs - Outputs collected during the bundle phase.
 *
 * @example Driving the package phase from a custom orchestrator
 * ```typescript
 * await runPackagePhase(context, config, formatOutputs)
 * ```
 */
export const runPackagePhase = async (ctx: BuildContext, config: BuildConfig, formatOutputs: FormatOutputs): Promise<void> => {
  const srcPkg = readProjectPackageJson(ctx.projectRoot)

  const bins = config.bin ?? []

  const distPkg = synthesizePackageJson(srcPkg, ctx, formatOutputs, {
    inheritFieldsFrom: config.inheritFieldsFrom,
    filterWorkspaceDepsFromOutput: config.filterWorkspaceDepsFromOutput,
    isWorkspacePackage: ctx.isWorkspacePackage,
    unpkg: config.unpkg,
    jsdelivr: config.jsdelivr,
    bins,
  })

  writeOutputPackageJson(ctx.outputPath, distPkg)
  copyAssets(ctx.assets, ctx.outputPath, srcPkg)

  if (config.thirdPartyLicenses === false) return
  const distDeps = keys(distPkg.dependencies ?? {})
  const bundled = collectBundledThirdPartyLicenses({
    workspaceRoot: ctx.workspaceRoot,
    projectRoot: ctx.projectRoot,
    external: [...distDeps, ...keys(srcPkg.peerDependencies ?? {}), ...ctx.external],
    isWorkspacePackage: ctx.isWorkspacePackage,
  })
  if (config.thirdPartyLicenses !== true && bundled.length === 0) return
  const entries = [...collectThirdPartyLicenses(ctx.workspaceRoot, distDeps), ...bundled].sort((a, b) => a.name.localeCompare(b.name))
  if (entries.length > 0) {
    writeThirdPartyLicensesFile(ctx.outputPath, generateThirdPartyLicensesContent(entries))
  }
}
