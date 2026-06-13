import type { BuildConfig, BuildContext, PackageJson } from '../models'
import { join, readJsonFile } from '@hyperfrontend/project-scope/core'
import { reflectFilesAllowlist } from './json/reflect-files-allowlist'
import { writeOutputPackageJson } from './json/write'

/**
 * Finalizes `package.json#files` as the last build step, after every emit phase
 * (bundle → package → bin → license/asset) and the orphan prune have run.
 *
 * The allowlist is **reflected** from the materialized output tree rather than
 * predicted from config: {@link reflectFilesAllowlist} walks `ctx.outputPath` so
 * the field names exactly what ships. The walk must run last because earlier
 * phases (notably the bin phase) emit files after the package phase writes the
 * manifest — reflecting before then would miss those survivors. An explicit
 * `config.files` short-circuits the walk and is honored verbatim.
 *
 * The already-written dist `package.json` is re-read, its `files` field set, and
 * the manifest written back. An empty allowlist (only possible via an explicit
 * `config.files: []`) leaves the manifest untouched.
 *
 * @param ctx - Resolved build context (provides `outputPath`).
 * @param config - Top-level builder configuration; reads the `files` override.
 *
 * @example Finalizing the allowlist after the bin phase
 * ```typescript
 * const binOutputs = await runBinPhase(ctx, config.bin ?? [])
 * finalizeFilesAllowlist(ctx, config)
 * ```
 */
export const finalizeFilesAllowlist = (ctx: BuildContext, config: BuildConfig): void => {
  const files = config.files ?? reflectFilesAllowlist(ctx.outputPath)
  if (files.length === 0) return
  const distPkg = readJsonFile<PackageJson>(join(ctx.outputPath, 'package.json'))
  distPkg.files = files
  writeOutputPackageJson(ctx.outputPath, distPkg)
}
