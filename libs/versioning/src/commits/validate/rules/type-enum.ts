import type { Rule } from '../models/rule'

/** Options for the type-enum rule. */
export interface TypeEnumOptions {
  /** Allowed commit type identifiers. Empty array disables the check. */
  readonly types: readonly string[]
}

/**
 * Rule that fails when the commit type is not in the configured allow-list.
 *
 * @example Enforcing a conventional type enum
 * ```typescript
 * typeEnumRule.check(
 *   parseConventionalCommit('feat: add x'),
 *   { level: 'error', options: { types: ['feat', 'fix'] } }
 * )
 * // => []
 * ```
 */
export const typeEnumRule: Rule<TypeEnumOptions> = {
  name: 'type-enum',
  check(commit, context) {
    const allowed = context.options?.types ?? []
    if (allowed.length === 0) return []
    if (commit.type === '') {
      return [`type must be one of [${allowed.join(', ')}] but was empty`]
    }
    if (!allowed.includes(commit.type)) {
      return [`type must be one of [${allowed.join(', ')}] but was "${commit.type}"`]
    }
    return []
  },
}
