import type { CommitFooter } from '../models/conventional'
import type { CommitDraft } from './models/draft'
import { isBreakingFooterKey } from '../models/breaking'
import { formatHeader } from './format-header'

/**
 * Renders a draft as the final commit message string: the exact text that
 * would be written to `.git/COMMIT_EDITMSG`. Layout: header, blank line,
 * body, blank line, footers.
 *
 * If `draft.breaking` and `draft.breakingDescription` are set and no
 * `BREAKING CHANGE:`-family footer is already present, one is synthesized
 * at the top of the footer block so the preview mirrors what a compliant
 * parser will read back.
 *
 * @param draft - Commit draft to render
 * @returns Full commit message string with `\n` separators
 *
 * @example Header only
 * ```typescript
 * formatCommitMessage({ type: 'feat', subject: 'add login' })
 * // => 'feat: add login'
 * ```
 *
 * @example Multi-scope breaking change with closing footer
 * ```typescript
 * formatCommitMessage({
 *   type: 'feat',
 *   scope: ['versioning', 'questions'],
 *   subject: 'add x',
 *   breaking: true,
 *   breakingDescription: 'removed Y',
 *   footers: [{ key: 'Closes', value: '#1', separator: ':' }],
 * })
 * // => 'feat(versioning,questions)!: add x\n\nBREAKING CHANGE: removed Y\nCloses: #1'
 * ```
 */
export function formatCommitMessage(draft: CommitDraft): string {
  const parts: string[] = [formatHeader(draft)]

  if (draft.body && draft.body.length > 0) {
    parts.push('')
    parts.push(draft.body)
  }

  const footers = resolveFooters(draft)
  if (footers.length > 0) {
    parts.push('')
    for (const footer of footers) {
      parts.push(renderFooter(footer))
    }
  }

  return parts.join('\n')
}

/**
 * Resolves the footer list to render, synthesizing a `BREAKING CHANGE:` entry
 * when the draft is breaking and no matching footer has been authored yet.
 *
 * @param draft - Draft to inspect
 * @returns Ordered footer list ready for rendering
 */
function resolveFooters(draft: CommitDraft): readonly CommitFooter[] {
  const existing = draft.footers ?? []
  if (!draft.breaking || !draft.breakingDescription) return existing
  if (existing.some((footer) => isBreakingFooterKey(footer.key))) return existing
  const synthesized: CommitFooter = {
    key: 'BREAKING CHANGE',
    value: draft.breakingDescription,
    separator: ':',
  }
  return [synthesized, ...existing]
}

/**
 * Serializes a single footer using its declared separator. Matches the
 * output the parser will read back in.
 *
 * @param footer - Footer to render
 * @returns One-line footer representation
 */
function renderFooter(footer: CommitFooter): string {
  const joiner = footer.separator === ':' ? ' ' : ''
  return `${footer.key}${footer.separator}${joiner}${footer.value}`
}
