import type { ConventionalCommit } from '../../models/conventional'

/** Severity level for a rule in a ruleset. */
export type RuleLevel = 'off' | 'warn' | 'error'

/** A single violation reported by the engine, tagged with its effective severity. */
export interface RuleMessage {
  /** Effective severity for this violation */
  readonly level: 'warn' | 'error'

  /** Human-readable description of the violation */
  readonly message: string

  /** Name of the rule that produced the violation */
  readonly ruleName: string
}

/** Aggregated list of violations produced by the engine for a single ruleset run. */
export type RuleResult = readonly RuleMessage[]

/** Runtime context passed to a rule invocation. */
export interface RuleContext<TOptions = undefined> {
  /** Effective severity the engine will apply to any violations */
  readonly level: RuleLevel

  /** Rule-specific options resolved from the ruleset config */
  readonly options?: TOptions
}

/**
 * Pure rule definition. Implementations inspect a `ConventionalCommit` and return
 * zero or more violation messages. The engine applies severity from the ruleset
 * config and aggregates `RuleMessage`s across all rules.
 */
export interface Rule<TOptions = undefined> {
  /** Stable identifier used to key the rule in a `Ruleset` */
  readonly name: string

  /**
   * Checks the commit against this rule.
   *
   * @param commit - Parsed conventional commit to validate
   * @param context - Resolved severity and options for this invocation
   * @returns List of violation descriptions; empty when the commit passes
   */
  check(commit: ConventionalCommit, context: RuleContext<TOptions>): readonly string[]
}
