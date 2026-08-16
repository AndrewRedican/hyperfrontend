import type { CommitDraft } from './models/draft'

/**
 * Builds the header line (`type(scope)!: subject`) from a draft.
 *
 * Missing fields render as empty; this is intentional so the header can be
 * displayed incrementally during authoring (e.g. before the subject has been
 * typed). Scopes are comma-joined to match the parser's multi-scope format.
 *
 * @param draft - Draft to render (may be partial)
 * @returns Header line; never contains a newline
 *
 * @example Rendering a complete header
 * ```typescript
 * formatHeader({ type: 'feat', scope: ['core'], subject: 'add login' })
 * // => 'feat(core): add login'
 * ```
 *
 * @example Rendering a multi-scope breaking-change header
 * ```typescript
 * formatHeader({ type: 'feat', scope: ['versioning', 'questions'], subject: 'add x', breaking: true })
 * // => 'feat(versioning,questions)!: add x'
 * ```
 *
 * @example Rendering a partially-built draft mid-session
 * ```typescript
 * formatHeader({ type: 'fix' })
 * // => 'fix: '
 * ```
 */
export function formatHeader(draft: CommitDraft): string {
  let header = draft.type ?? ''

  if (draft.scope && draft.scope.length > 0) {
    header += `(${draft.scope.join(',')})`
  }

  if (draft.breaking) {
    header += '!'
  }

  header += `: ${draft.subject ?? ''}`

  return header
}
