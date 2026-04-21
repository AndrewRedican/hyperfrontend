/**
 * Pure formatter that renders a `CommitDraft` (the in-progress shape of
 * `ConventionalCommit`) into the final commit message string — the exact
 * text that would land in `.git/COMMIT_EDITMSG`. Used by the authoring
 * session's preview step and by the subject step's live header countdown.
 *
 * @module @hyperfrontend/versioning/commits/format
 */
export type { CommitDraft } from './models/draft'
export { countHeaderLength } from './count-header'
export { formatHeader } from './format-header'
export { formatCommitMessage } from './format-message'
export { toDraft } from './models/draft'
