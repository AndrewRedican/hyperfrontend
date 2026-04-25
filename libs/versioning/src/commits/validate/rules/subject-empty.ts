import type { Rule } from '../models/rule'

/**
 * Rule that fails when the commit subject is empty or whitespace-only.
 *
 * @example Enforcing a non-empty subject
 * ```typescript
 * subjectEmptyRule.check(
 *   parseConventionalCommit('feat: '),
 *   { level: 'error' }
 * )
 * // => ['subject must not be empty']
 * ```
 */
export const subjectEmptyRule: Rule = {
  name: 'subject-empty',
  check(commit) {
    if (commit.subject.trim() === '') {
      return ['subject must not be empty']
    }
    return []
  },
}
