/**
 * Pure formatter rendering a `CommitDraft` into the final message string: the
 * exact text that would land in `.git/COMMIT_EDITMSG`.
 *
 * @module @hyperfrontend/versioning/commits/format
 */
export type { CommitDraft } from './models/draft'
export { countHeaderLength } from './count-header'
export { formatHeader } from './format-header'
export { formatCommitMessage } from './format-message'
export { toDraft } from './models/draft'
