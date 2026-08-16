import type { CommitType } from '../../models/commit-type'
import type { CommitFooter, ConventionalCommit } from '../../models/conventional'

/**
 * In-progress version of a `ConventionalCommit` accumulated field-by-field
 * during an interactive authoring session. Every field is optional so the
 * formatter can render intermediate states (e.g. the header as it exists
 * after only `type` has been picked).
 *
 * @see ConventionalCommit
 */
export interface CommitDraft {
  /** Commit type (feat, fix, docs, etc.) */
  readonly type?: CommitType

  /** Scopes in parentheses (empty or omitted = no scope) */
  readonly scope?: readonly string[]

  /** Subject line */
  readonly subject?: string

  /** Full commit body */
  readonly body?: string

  /** Footer trailers: caller may leave out `BREAKING CHANGE:`; the formatter will synthesize it when needed */
  readonly footers?: readonly CommitFooter[]

  /** Whether this is a breaking change: controls the `!` subject marker */
  readonly breaking?: boolean

  /** Breaking change description: surfaces as a `BREAKING CHANGE:` footer when none is already present */
  readonly breakingDescription?: string
}

/**
 * Promotes any `ConventionalCommit` to a `CommitDraft`. Useful for editing
 * a parsed commit inside an authoring session.
 *
 * @param commit - Parsed conventional commit
 * @returns A draft carrying the same fields as the commit
 *
 * @example Promoting a parsed commit to an editable draft
 * ```typescript
 * toDraft(parseConventionalCommit('feat: add login'))
 * // => { type: 'feat', scope: [], subject: 'add login', footers: [], breaking: false }
 * ```
 */
export function toDraft(commit: ConventionalCommit): CommitDraft {
  return {
    type: commit.type,
    scope: commit.scope,
    subject: commit.subject,
    body: commit.body,
    footers: commit.footers,
    breaking: commit.breaking,
    breakingDescription: commit.breakingDescription,
  }
}
