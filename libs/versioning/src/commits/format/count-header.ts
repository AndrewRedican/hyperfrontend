import type { CommitDraft } from './models/draft'
import { formatHeader } from './format-header'

/**
 * Computes the character length of the final header including the
 * `type(scope)!: ` prefix and the supplied subject. Powers the live
 * 72-character countdown shown during the subject prompt.
 *
 * The subject is passed separately (not read from `draft.subject`) because
 * the caller typically has not yet committed the in-flight input to the
 * draft.
 *
 * @param draft - Draft supplying type, scope, and breaking marker
 * @param subject - Subject text being typed
 * @returns Character length the final header will occupy
 *
 * @example Counting a header mid-type
 * ```typescript
 * countHeaderLength({ type: 'feat', scope: ['core'] }, 'add login')
 * // => 'feat(core): add login'.length === 21
 * ```
 */
export function countHeaderLength(draft: CommitDraft, subject: string): number {
  return formatHeader({ ...draft, subject }).length
}
