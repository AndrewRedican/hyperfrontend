import type { Rule } from '../models/rule'

/** Options for the scope-enum rule. */
export interface ScopeEnumOptions {
  /** Allowed scope identifiers. Empty array disables the check. */
  readonly scopes: readonly string[]
}

/**
 * Rule that fails when any scope on the commit is not in the configured
 * allow-list. A commit with no scopes (empty array) always passes; when scopes
 * are required, pair this rule with a separate scope-empty check.
 *
 * @example Enforcing a scope enum
 * ```typescript
 * scopeEnumRule.check(
 *   parseConventionalCommit('feat(auth): add login'),
 *   { level: 'error', options: { scopes: ['auth', 'api'] } }
 * )
 * // => []
 * ```
 */
export const scopeEnumRule: Rule<ScopeEnumOptions> = {
  name: 'scope-enum',
  check(commit, context) {
    const allowed = context.options?.scopes ?? []
    if (allowed.length === 0) return []
    if (commit.scope.length === 0) return []
    const violations: string[] = []
    for (const scope of commit.scope) {
      if (!allowed.includes(scope)) {
        violations.push(`scope must be one of [${allowed.join(', ')}] but found "${scope}"`)
      }
    }
    return violations
  },
}
