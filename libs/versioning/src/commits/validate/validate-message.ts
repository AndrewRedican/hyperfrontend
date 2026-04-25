import type { Ruleset, ValidationResult } from './models/ruleset'
import { parseConventionalCommit } from '../parse/message'
import { validateCommit } from './engine'

/**
 * Parses a raw commit message and validates the resulting commit against the
 * supplied ruleset. Used by the `cl` bin and anywhere else validation must
 * start from a string rather than a parsed commit.
 *
 * @param raw - Raw commit message (as written to `.git/COMMIT_EDITMSG`)
 * @param ruleset - Configuration map from rule name to `[level, options?]`
 * @returns Aggregated validation result
 *
 * @example Validating a raw commit message
 * ```typescript
 * validateCommitMessage('feat: add login', conventionalPreset)
 * // => { valid: true, warnings: [], errors: [] }
 *
 * validateCommitMessage('feat: added login', conventionalPreset).warnings
 * // => [{ level: 'warn', ruleName: 'imperative-mood', message: ... }]
 * ```
 */
export function validateCommitMessage(raw: string, ruleset: Ruleset): ValidationResult {
  return validateCommit(parseConventionalCommit(raw), ruleset)
}
