import type { BuildConfig, BuildContext, FormatOutputs } from '../models'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { copyAssets } from './assets/copy-assets'
import { readProjectPackageJson } from './json/read-package-json'
import { synthesizePackageJson } from './json/synthesize'
import { writeOutputPackageJson } from './json/write'
import { collectThirdPartyLicenses } from './licenses/collect'
import { generateThirdPartyLicensesContent } from './licenses/generate-content'
import { writeThirdPartyLicensesFile } from './licenses/write'

const resolveThirdPartyLicensesFlag = (config: BuildConfig, ctx: BuildContext): boolean => {
  if (typeof config.thirdPartyLicenses === 'boolean') return config.thirdPartyLicenses
  return ctx.bundledDeps.length > 0
}

const collectLicenseDeps = (ctx: BuildContext, distDeps: string[]): string[] => from(createSet([...ctx.bundledDeps, ...distDeps]))

/**
 * Runs the complete package phase: synthesizes and writes the dist
 * `package.json`, materializes any configured asset specs, and (when
 * `config.thirdPartyLicenses` is enabled — defaulting to `true` for builds
 * with at least one bundled dep) emits `THIRD_PARTY_LICENSES.md`.
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

  if (resolveThirdPartyLicensesFlag(config, ctx)) {
    const distDeps = keys(distPkg.dependencies ?? {})
    const externals = collectLicenseDeps(ctx, distDeps)
    const entries = collectThirdPartyLicenses(ctx.projectRoot, ctx.workspaceRoot, externals)
    if (entries.length > 0) {
      writeThirdPartyLicensesFile(ctx.outputPath, generateThirdPartyLicensesContent(entries))
    }
  }
}
