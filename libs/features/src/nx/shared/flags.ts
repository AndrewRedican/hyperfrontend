import type { CliFlags } from '../../cli'

/** Scalar/path flags an executor may forward, excluding the headless toggles. */
type FlagOverrides = Omit<Partial<CliFlags>, 'ci' | 'yes' | 'dryRun' | 'help'>

/**
 * Build a headless {@link CliFlags} object for delegating to an SDK runner.
 *
 * Executors run non-interactively, so prompts are suppressed (`ci: true`) and
 * the preview/usage toggles are off; callers supply only the scalar and path
 * flags relevant to their command.
 *
 * @param overrides - Command-specific scalar and path flags to forward.
 * @returns A fully populated, headless CLI flag set.
 *
 * @example Forward a config path to a runner
 * ```ts
 * const flags = headlessFlags({ config: './hf.config.json' })
 * // { ci: true, yes: false, dryRun: false, help: false, config: './hf.config.json' }
 * ```
 */
export function headlessFlags(overrides: FlagOverrides): CliFlags {
  return { ci: true, yes: false, dryRun: false, help: false, ...overrides }
}
