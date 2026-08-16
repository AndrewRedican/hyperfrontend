import type { PartialSessionConfig, SessionConfig } from '../models/session-config'
import type { Step } from '../models/step'
import { conventionalPreset } from '../presets/conventional'
import { resolveSessionConfig } from './resolve-config'

/**
 * Inputs accepted by `createAuthorSession`: the caller may supply their own
 * step list; anything missing is resolved against the defaults used by the
 * conventional preset.
 */
export interface CreateAuthorSessionOptions {
  /** Override for the step sequence; defaults to `conventionalPreset` */
  readonly steps?: readonly Step[]

  /** Partial configuration overlaid on the built-in defaults */
  readonly config?: PartialSessionConfig
}

/**
 * Prepared session ready to be handed to `runAuthorSession`. Contains the
 * fully resolved config and the ordered step list that will be executed.
 */
export interface AuthorSession {
  /** Ordered step list the runner will iterate */
  readonly steps: readonly Step[]

  /** Fully resolved session configuration */
  readonly config: SessionConfig
}

/**
 * Prepares an authoring session without executing it. The returned object
 * carries a resolved `config` (defaults filled in) and the effective step
 * list, allowing bin wrappers to introspect before running.
 *
 * @param options - Optional overrides for steps and partial config
 * @returns Session description consumable by `runAuthorSession`
 *
 * @example Using the conventional preset and default config
 * ```typescript
 * const session = createAuthorSession()
 * await runAuthorSession(session)
 * ```
 *
 * @example Overriding only the validate ruleset
 * ```typescript
 * createAuthorSession({ config: { validateRuleset: customRuleset } })
 * ```
 */
export function createAuthorSession(options: CreateAuthorSessionOptions = {}): AuthorSession {
  return {
    steps: options.steps ?? conventionalPreset,
    config: resolveSessionConfig(options.config),
  }
}
