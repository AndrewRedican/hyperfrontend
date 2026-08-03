import type { PromiseExecutor } from '../../model'
import { EXIT_OK, runBuild } from '../../../cli'
import { resolveProjectCwd } from '../../shared/context'
import { headlessFlags } from '../../shared/flags'
import { warnIfRollupBindingMissing } from '../../shared/rollup-binding'

/** Options for the `build` executor; mirrors `schema.json`. */
export interface BuildExecutorSchema {
  /** Path to the feature config object. */
  config?: string
  /** Output directory for the built shell. */
  out?: string
  /** Security envelope to enforce at build time: `none`, `v1`, or `v2`. */
  protocol?: string
  /** Feature name override. */
  name?: string
  /** Feature version override. */
  version?: string
  /** URL the generated shell loads the feature from. */
  url?: string
  /** Path to the contract file. */
  contract?: string
  /** Acknowledge an explicit `none` protocol and build an open, unauthenticated shell. */
  allowOpen?: boolean
}

/**
 * Build a hyperfrontend feature's shell package by delegating to the SDK's `hf build`.
 *
 * Maps the executor options to headless CLI flags and runs the build against
 * the executing project's root directory.
 *
 * @param options - Schema-validated build options.
 * @param context - The Nx executor context for the running target.
 * @returns A result whose `success` reflects the SDK build's exit code.
 *
 * @example Running the executor programmatically
 * ```typescript
 * const result = await runBuildExecutor({ config: './feature.config.json' }, context)
 * ```
 */
export const runBuildExecutor: PromiseExecutor<BuildExecutorSchema> = async (options, context) => {
  const code = await runBuild({
    flags: headlessFlags({
      config: options.config,
      out: options.out,
      protocol: options.protocol,
      name: options.name,
      version: options.version,
      url: options.url,
      contract: options.contract,
      allowOpen: options.allowOpen,
    }),
    cwd: resolveProjectCwd(context),
    stdout: process.stdout,
    stderr: process.stderr,
  })
  if (code !== EXIT_OK) {
    // why: a missing rollup platform binding is the most opaque way this build fails; explain the fix when that is the cause.
    warnIfRollupBindingMissing(context.root)
  }
  return { success: code === EXIT_OK }
}

export default runBuildExecutor
