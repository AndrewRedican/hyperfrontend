export type { GitLogOptions } from './log'
export type { GitTagOptions, ListTagsOptions } from './query-tags'
export type { CreateTagOptions } from './manage-tags'
export type { GitCommitOptions, CreateCommitOptions } from './commit'
export type { StageOptions } from './stage'
export type { GitStatusOptions, FileStatus, FileStatusEntry, RepositoryStatus } from './status'
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
export { DEFAULT_TAG_OPTIONS, getTags, getTag, tagExists, getLatestTag, getTagsForPackage, escapeGitTagPattern } from './query-tags'
export { createTag, deleteTag, pushTag, escapeGitMessage } from './manage-tags'
export { DEFAULT_COMMIT_OPTIONS, commit, amendCommit, amendCommitNoEdit, createEmptyCommit, escapeFilePath, escapeAuthor } from './commit'
export { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges } from './stage'
export { getHead, getCurrentBranch, hasUntrackedFiles } from './head-info'
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
