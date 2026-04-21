import type { ConventionalCommit } from '../models/conventional'
import type { Rule, RuleLevel, RuleMessage } from './models/rule'
import type { Ruleset, ValidationResult } from './models/ruleset'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { headerMaxLengthRule } from './rules/header-max-length'
import { imperativeMoodRule } from './rules/imperative-mood'
import { scopeEnumRule } from './rules/scope-enum'
import { subjectCaseRule } from './rules/subject-case'
import { subjectEmptyRule } from './rules/subject-empty'
import { typeEnumRule } from './rules/type-enum'

/** Registry of built-in rules the engine knows how to run, keyed by rule name. */
export const BUILT_IN_RULES: Readonly<Record<string, Rule<never>>> = {
  [typeEnumRule.name]: <Rule<never>>typeEnumRule,
  [scopeEnumRule.name]: <Rule<never>>scopeEnumRule,
  [subjectCaseRule.name]: <Rule<never>>subjectCaseRule,
  [subjectEmptyRule.name]: <Rule<never>>subjectEmptyRule,
  [headerMaxLengthRule.name]: <Rule<never>>headerMaxLengthRule,
  [imperativeMoodRule.name]: <Rule<never>>imperativeMoodRule,
}

/**
 * Runs every rule configured in the ruleset against a parsed commit and
 * aggregates the resulting warnings and errors.
 *
 * Rules whose config is `'off'` (or absent from the ruleset) are skipped.
 * Unknown rule names in the ruleset are ignored — consumers extend the engine
 * by calling `validateCommitWithRules()` and supplying additional rules.
 *
 * @param commit - Parsed conventional commit to validate
 * @param ruleset - Configuration map from rule name to `[level, options?]`
 * @returns Aggregated validation result
 *
 * @example Validating a commit against a preset ruleset
 * ```typescript
 * validateCommit(parseConventionalCommit('feat: add login'), conventionalPreset)
 * // => { valid: true, warnings: [], errors: [] }
 * ```
 */
export function validateCommit(commit: ConventionalCommit, ruleset: Ruleset): ValidationResult {
  return validateCommitWithRules(commit, ruleset, BUILT_IN_RULES)
}

/**
 * Variant of `validateCommit` that accepts a caller-supplied rule registry.
 * Useful for consumers that want to add project-specific rules without
 * forking the built-in set.
 *
 * @param commit - Parsed conventional commit to validate
 * @param ruleset - Configuration map from rule name to `[level, options?]`
 * @param rules - Rule registry keyed by rule name
 * @returns Aggregated validation result
 *
 * @example Extending the built-in rules with a custom rule
 * ```typescript
 * const customRules = { ...BUILT_IN_RULES, 'no-wip': noWipRule }
 * validateCommitWithRules(commit, { 'no-wip': ['error'] }, customRules)
 * ```
 */
export function validateCommitWithRules(
  commit: ConventionalCommit,
  ruleset: Ruleset,
  rules: Readonly<Record<string, Rule<never>>>
): ValidationResult {
  const warnings: RuleMessage[] = []
  const errors: RuleMessage[] = []

  for (const [ruleName, config] of entries(ruleset)) {
    const level = <RuleLevel>config[0]
    if (level === 'off') continue
    const rule = rules[ruleName]
    if (rule === undefined) continue

    const options = config.length > 1 ? config[1] : undefined
    const violations = rule.check(commit, { level, options: <never>options })

    for (const message of violations) {
      const entry: RuleMessage = { level, message, ruleName }
      if (level === 'error') {
        errors.push(entry)
      } else {
        warnings.push(entry)
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  }
}
