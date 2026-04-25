import type { RuleLevel, RuleMessage } from './rule'

/**
 * Configuration tuple for a single rule in a ruleset.
 *
 * A bare `[level]` entry disables the rule when level is `'off'`, or enables it
 * with no options otherwise. The `[level, options]` form passes rule-specific
 * options through to the rule's `check()` implementation.
 */
export type RuleConfig<TOptions = unknown> = readonly [RuleLevel] | readonly [RuleLevel, TOptions]

/**
 * Mapping from rule name to its config tuple. Rules not present in the map are
 * treated as `'off'` by the engine.
 */
export type Ruleset = Readonly<Record<string, RuleConfig>>

/** Aggregated outcome of running a ruleset over a commit. */
export interface ValidationResult {
  /** True when no error-level violations were recorded */
  readonly valid: boolean

  /** Warn-level violations (non-blocking) */
  readonly warnings: readonly RuleMessage[]

  /** Error-level violations (blocking) */
  readonly errors: readonly RuleMessage[]
}
