import type { ConventionalCommit } from '../../models/conventional'
import type { Rule } from '../models/rule'

/** Options for the header-max-length rule. */
export interface HeaderMaxLengthOptions {
  /** Maximum allowed header length. Use `null` to disable the check. */
  readonly maxLength: number | null
}

/**
 * Rule that fails when the reconstructed header (`type(scope)!: subject`)
 * exceeds the configured maximum length.
 *
 * @example Enforcing a 72-character header limit
 * ```typescript
 * headerMaxLengthRule.check(
 *   parseConventionalCommit('feat(core): short subject'),
 *   { level: 'warn', options: { maxLength: 72 } }
 * )
 * // => []
 * ```
 */
export const headerMaxLengthRule: Rule<HeaderMaxLengthOptions> = {
  name: 'header-max-length',
  check(commit, context) {
    const maxLength = context.options?.maxLength
    if (maxLength === null || maxLength === undefined) return []
    const header = reconstructHeader(commit)
    if (header.length <= maxLength) return []
    return [`header must be ≤ ${maxLength} characters but was ${header.length}: "${header}"`]
  },
}

/**
 * Rebuilds the header line from parsed parts so the length check does not
 * depend on the raw message (which may include trailing whitespace or be
 * absent on in-progress drafts).
 *
 * @param commit - Parsed commit to reconstruct
 * @returns Header line in conventional-commit form
 */
function reconstructHeader(commit: ConventionalCommit): string {
  let header = commit.type
  if (commit.scope.length > 0) {
    header += `(${commit.scope.join(',')})`
  }
  if (commit.breaking) {
    header += '!'
  }
  header += `: ${commit.subject}`
  return header
}
