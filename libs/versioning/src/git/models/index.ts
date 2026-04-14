/**
 * Git data models for commits, tags, and refs with factory functions and utilities.
 *
 * @module @hyperfrontend/versioning/git/models
 */
export type { GitCommit, CreateGitCommitOptions } from './commit'
export type { GitTag, GitTagType, CreateLightweightTagOptions, CreateAnnotatedTagOptions } from './tag'
export type { GitRef, GitRefType, CreateGitRefOptions } from './ref'
export { createGitCommit, getShortHash, isSameCommit, isMergeCommit, isRootCommit, extractScope, extractType } from './commit'
export {
  createLightweightTag,
  createAnnotatedTag,
  isAnnotatedTag,
  isLightweightTag,
  extractVersionFromTag,
  extractPackageFromTag,
  buildTagName,
  compareTagsByVersion,
} from './tag'
export {
  createGitRef,
  isBranchRef,
  isTagRef,
  isRemoteRef,
  isHeadRef,
  getRemote,
  buildRefName,
  compareRefsByName,
  filterRefsByType,
  filterRefsByRemote,
} from './ref'
