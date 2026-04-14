/**
 * Conventional commit types, factories, and semver bump derivation.
 *
 * @module @hyperfrontend/versioning/commits/models
 */
export type { ConventionalCommit, CommitFooter } from './conventional'
export type { CommitType } from './commit-type'
export type { BreakingChange } from './breaking'
export { createCommitFooter, createConventionalCommit } from './conventional'
export { COMMIT_TYPES, getSemverBump, isReleaseType, isStandardType, MINOR_TYPES, PATCH_TYPES, RELEASE_TYPES } from './commit-type'
export { createBreakingFromFooter, createBreakingFromSubject, createNonBreaking, isBreakingFooterKey } from './breaking'
