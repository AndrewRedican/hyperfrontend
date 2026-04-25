import type { Rule } from '../models/rule'

/** Default past-tense → imperative word map used when options are omitted. */
export const DEFAULT_IMPERATIVE_WORDLIST: Readonly<Record<string, string>> = {
  added: 'add',
  updated: 'update',
  fixed: 'fix',
  removed: 'remove',
  changed: 'change',
  modified: 'modify',
  created: 'create',
  deleted: 'delete',
  improved: 'improve',
  refactored: 'refactor',
  implemented: 'implement',
  renamed: 'rename',
  moved: 'move',
}

/** Options for the imperative-mood rule. */
export interface ImperativeMoodOptions {
  /**
   * Map of past-tense words (lowercase) to their suggested imperative forms.
   * Overrides `DEFAULT_IMPERATIVE_WORDLIST` when provided.
   */
  readonly wordlist?: Readonly<Record<string, string>>
}

/**
 * Rule that reports a warning when the first subject word (case-insensitive)
 * matches a known past-tense form. Never blocks; intended as a nudge.
 *
 * @example Hinting on past-tense verbs
 * ```typescript
 * imperativeMoodRule.check(
 *   parseConventionalCommit('feat: added login'),
 *   { level: 'warn' }
 * )
 * // => ['subject should use imperative mood: use "add" instead of "added"']
 * ```
 */
export const imperativeMoodRule: Rule<ImperativeMoodOptions> = {
  name: 'imperative-mood',
  check(commit, context) {
    const subject = commit.subject.trim()
    if (subject === '') return []
    const wordlist = context.options?.wordlist ?? DEFAULT_IMPERATIVE_WORDLIST
    const firstWord = extractFirstWord(subject).toLowerCase()
    if (firstWord === '') return []
    const imperative = wordlist[firstWord]
    if (imperative === undefined) return []
    return [`subject should use imperative mood: use "${imperative}" instead of "${firstWord}"`]
  },
}

/**
 * Extracts the first whitespace-delimited word from the subject.
 *
 * @param subject - Trimmed subject text
 * @returns First word (may be empty when the subject is whitespace-only)
 */
function extractFirstWord(subject: string): string {
  let end = 0
  while (end < subject.length && subject[end] !== ' ' && subject[end] !== '\t') {
    end++
  }
  return subject.slice(0, end)
}
