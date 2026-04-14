/**
 * Git shell command wrappers for log, tag, commit, staging, status, and diff operations.
 *
 * @module @hyperfrontend/versioning/git/operations
 */
export type { GitCommitOptions, CreateCommitOptions } from './commit'
export type { FileChangeStatus, FileChange, DiffOptions, GitCommitWithFiles } from './diff'
export type { GitLogOptions } from './log'
export type { CreateTagOptions } from './manage-tags'
export type { GitOperationStateReason, GitOperationState, GitOperationStateOptions } from './operation-state'
export type { GitTagOptions, ListTagsOptions } from './query-tags'
export type { StageOptions, DiscardChangesOptions } from './stage'
export type { GitStatusOptions, FileStatus, FileStatusEntry, RepositoryStatus } from './status'
export { DEFAULT_COMMIT_OPTIONS, commit, amendCommit, amendCommitNoEdit, createEmptyCommit, escapeFilePath, escapeAuthor } from './commit'
export { DEFAULT_DIFF_OPTIONS, getChangedFilesBetween, getChangedFilesBetweenWithStatus, getCommitWithFiles } from './diff'
export { getHead, getCurrentBranch, hasUntrackedFiles } from './head-info'
export {
  DEFAULT_LOG_OPTIONS,
  getCommitLog,
  getCommitsBetween,
  getCommitsSince,
  getCommit,
  commitExists,
  commitReachableFromHead,
  escapeGitRef,
  escapeGitPath,
  escapeGitArg,
} from './log'
export { createTag, deleteTag, pushTag, escapeGitMessage } from './manage-tags'
export { DEFAULT_OPERATION_STATE_OPTIONS, getOperationState, isOperationInProgress } from './operation-state'
export { DEFAULT_TAG_OPTIONS, getTags, getTag, tagExists, getLatestTag, getTagsForPackage, escapeGitTagPattern } from './query-tags'
export { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges, discardChanges, discardAllChanges } from './stage'
export {
  DEFAULT_STATUS_OPTIONS,
  getStatus,
  isClean,
  isGitRepository,
  getRepositoryRoot,
  getHeadHash,
  getHeadShortHash,
  hasConflicts,
  getAheadCount,
  getBehindCount,
  needsPush,
  needsPull,
  getStagedFiles,
  getModifiedFiles,
  getUntrackedFiles,
} from './status'
