// @hyperfrontend/versioning - Main entry point
//
// A versioning library with changelog parsing, conventional commits,
// and semver flow orchestration. Uses character-by-character state machines
// for parsing (no regex) to ensure ReDoS safety.

// ============================================================================
// Changelog module
// ============================================================================

// Changelog Models - Type definitions
export type { Changelog, ChangelogFormat, ChangelogHeader, ChangelogLink, ChangelogMetadata } from './changelog/models/changelog'
export type { ChangelogEntry, ChangelogItem, ChangelogSection } from './changelog/models/entry'
export type { ChangelogSectionType } from './changelog/models/section'
export type { CommitRef, IssueRef } from './changelog/models/commit-ref'
export type { CompatibilityResult, SchemaDifference } from './changelog/models/schema'

// Changelog Models - Factory functions
export { createChangelog, createChangelogLink, createEmptyChangelog } from './changelog/models/changelog'
export { createChangelogEntry, createChangelogItem, createChangelogSection, createUnreleasedEntry } from './changelog/models/entry'
export { getSectionType, SECTION_HEADINGS, SECTION_TYPE_MAP } from './changelog/models/section'
export { createCommitRef, createIssueRef, getShortHash } from './changelog/models/commit-ref'

// Changelog Schema Validation
export { changelogSchema, validateChangelog, checkSchemaCompatibility } from './changelog/models/schema'

// Changelog Parsing
export { parseChangelog } from './changelog/parse/parser'
export { tokenize } from './changelog/parse/tokenizer'
export type { Token, TokenType } from './changelog/parse/tokenizer'
export { parseVersionFromHeading, parseCommitRefs, parseIssueRefs, parseScopeFromItem } from './changelog/parse/line'

// Changelog Serialization
export type { SerializeOptions, JsonSerializeOptions } from './changelog/serialize'
export {
  serializeChangelog,
  serializeChangelogToJson,
  toJsonObject,
  DEFAULT_SERIALIZE_OPTIONS,
  resolveOptions,
  getSectionHeading,
  formatLink,
  getListMarker,
  createSpacing,
} from './changelog/serialize'

// Changelog Comparison
export type { ChangelogDiff, DiffStats, EntryDiff, SectionDiff, ItemDiff, PropertyDiff } from './changelog/compare'
export {
  isChangelogEqual,
  isHeaderEqual,
  isLinkEqual,
  isEntryEqual,
  isSectionEqual,
  isItemEqual,
  isCommitRefEqual,
  isIssueRefEqual,
  isMetadataEqual,
  haveSameVersions,
  hasVersion,
  getEntryByVersion,
  diffChangelogs,
  diffEntries,
  summarizeDiff,
} from './changelog/compare'

// Changelog Operations
export type {
  AddEntryOptions,
  RemoveEntryOptions,
  EntryPredicate,
  SectionPredicate,
  ItemPredicate,
  MergeStrategy,
  MergeOptions,
  MergeResult,
  MergeStats,
  EntryTransformer,
  SectionTransformer,
  ItemTransformer,
} from './changelog/operations'
export {
  addEntry,
  addUnreleasedEntry,
  releaseUnreleased,
  addItemToEntry,
  removeEntry,
  removeEntries,
  removeUnreleased,
  removeSection,
  removeItem,
  removeEmptySections,
  removeEmptyEntries,
  filterEntries,
  filterByVersionRange,
  filterFromVersion,
  filterToVersion,
  filterVersionRange,
  filterRecentEntries,
  filterBreakingChanges,
  filterByDateRange,
  filterSections,
  filterSectionTypes,
  filterItems,
  filterByScope,
  excludeByScope,
  mergeChangelogs,
  appendChangelog,
  combineChangelogs,
  DEFAULT_MERGE_OPTIONS,
  transformEntries,
  transformSections,
  transformItems,
  updateHeader,
  updateMetadata,
  updateEntry,
  sortEntries,
  sortEntriesByDate,
  reverseEntries,
  sortSections,
  normalizeSectionHeadings,
  deduplicateItems,
  compact,
  stripMetadata,
  cloneChangelog,
} from './changelog/operations'

// ============================================================================
// Commits module
// ============================================================================

// Commits Models - Type definitions
export type { ConventionalCommit, CommitFooter } from './commits/models/conventional'
export type { CommitType } from './commits/models/commit-type'
export type { BreakingChange } from './commits/models/breaking'

// Commits Models - Factory functions and utilities
export { createCommitFooter, createConventionalCommit } from './commits/models/conventional'
export {
  COMMIT_TYPES,
  getSemverBump,
  isReleaseType,
  isStandardType,
  MINOR_TYPES,
  PATCH_TYPES,
  RELEASE_TYPES,
} from './commits/models/commit-type'
export { createBreakingFromFooter, createBreakingFromSubject, createNonBreaking, isBreakingFooterKey } from './commits/models/breaking'

// Commits Parsing
export { parseConventionalCommit, isConventionalCommit } from './commits/parse/message'
export { parseHeader, type ParsedHeader } from './commits/parse/header'
export { parseBody, type ParsedBody } from './commits/parse/body'
export { parseFooters, type ParsedFooters } from './commits/parse/footer'

// Commits Classification - Constants
export { DEFAULT_EXCLUDE_SCOPES, DEFAULT_PROJECT_PREFIXES } from './commits/classify'

// Flow Steps - Constants
export { DEFAULT_COMMIT_TYPE_TO_SECTION } from './flow/steps'

// ============================================================================
// SemVer module
// ============================================================================

// SemVer Models - Type definitions
export type { SemVer, BumpType } from './semver/models/version'
export type { Range, Comparator, ComparatorSet, RangeOperator } from './semver/models/range'

// SemVer Models - Factory functions
export {
  createSemVer,
  createInitialVersion,
  createFirstRelease,
  isPrerelease,
  isStable,
  stripBuild,
  stripPrerelease,
} from './semver/models/version'
export { createComparator, createComparatorSet, createRange, createAnyRange, createExactRange, isWildcard } from './semver/models/range'

// SemVer Parsing
export type { ParseVersionResult } from './semver/parse/version'
export type { ParseRangeResult } from './semver/parse/range'
export { parseVersion, parseVersionStrict, coerceVersion } from './semver/parse/version'
export { parseRange, parseRangeStrict } from './semver/parse/range'

// SemVer Comparison
export { compare, eq, lt, lte, gt, gte, neq, satisfies, satisfiesComparator, maxSatisfying, minSatisfying } from './semver/compare/compare'
export { sort, sortDescending, max, min } from './semver/compare/sort'

// SemVer Increment
export { increment, incrementPrerelease, diff } from './semver/increment/bump'

// SemVer Format
export { format, formatSimple, formatRange, formatComparator } from './semver/format/to-string'

// ============================================================================
// Registry module
// ============================================================================

// Registry Models - Type definitions
export type { Registry, RegistryConfig } from './registry/models/registry'
export type { PackageInfo } from './registry/models/package-info'
export type { VersionInfo, Maintainer } from './registry/models/version-info'

// Registry Models - Factory functions
export { createPackageInfo } from './registry/models/package-info'
export { createVersionInfo } from './registry/models/version-info'

// Registry npm client
export { createNpmRegistry, escapePackageName, escapeVersion } from './registry/npm/client'
export { createCache } from './registry/npm/cache'
export type { Cache, CacheEntry } from './registry/npm/cache'

// Registry factory
export { createRegistry } from './registry/factory'
export type { RegistryType } from './registry/factory'

// ============================================================================
// Workspace module
// ============================================================================

// Workspace Models - Type definitions
export type { Workspace, WorkspaceConfig, WorkspaceType } from './workspace/models/workspace'
export type { Project, CreateProjectOptions } from './workspace/models/project'

// Workspace Models - Factory functions
export {
  DEFAULT_PATTERNS,
  DEFAULT_EXCLUDE,
  DEFAULT_WORKSPACE_CONFIG,
  createWorkspaceConfig,
  createWorkspace,
  getProject,
  hasProject,
  getProjectNames,
  getProjectCount,
  getDependents,
  getDependencies,
  dependsOn,
} from './workspace/models/workspace'
export {
  createProject,
  isPublishable,
  isPrivate,
  hasChangelog as hasProjectChangelog,
  hasInternalDependencies,
  hasInternalDependents,
  getDependencyCount,
  getDependentCount,
  withDependents,
  addDependent,
} from './workspace/models/project'

// Workspace Discovery
export type { DiscoveryOptions, DiscoveryResult } from './workspace/discovery/packages'
export type { DiscoveredChangelog } from './workspace/discovery/discover-changelogs'
export type { DependencyGraph, DependencyType, DependencyEdge, DependencyGraphAnalysis } from './workspace/discovery/dependencies'
export { discoverPackages, discoverProject, discoverProjectByName } from './workspace/discovery/packages'
export { CHANGELOG_NAMES, findChangelogs, findProjectChangelog, discoverAllChangelogs } from './workspace/discovery/discover-changelogs'
export { hasChangelog, getExpectedChangelogPath } from './workspace/discovery/changelog-path'
export {
  findInternalDependencies,
  findInternalDependenciesWithTypes,
  buildDependencyGraph,
  getTopologicalOrder,
  getTransitiveDependents,
  getTransitiveDependencies,
  transitivelyDependsOn,
} from './workspace/discovery/dependencies'

// Workspace Operations
export type { PlannedBump, BumpReason, CascadeBumpOptions, CascadeBumpResult, DirectBumpInput } from './workspace/operations/cascade-bump'
export type { BatchUpdateResult, UpdatedPackage, FailedUpdate, BatchUpdateOptions } from './workspace/operations/batch-update'
export type {
  ValidationResult as WorkspaceValidationResult,
  ValidationReport,
  ValidationCheckResult,
} from './workspace/operations/validate'
export {
  DEFAULT_CASCADE_OPTIONS,
  calculateCascadeBumps,
  calculateCascadeBumpsFromPackage,
  summarizeCascadeBumps,
} from './workspace/operations/cascade-bump'
export {
  DEFAULT_BATCH_UPDATE_OPTIONS,
  applyBumps,
  updatePackageVersionInTree,
  summarizeBatchUpdate,
} from './workspace/operations/batch-update'
export { validateWorkspace, validateProject, summarizeValidation } from './workspace/operations/validate'

// Workspace convenience function
export { createWorkspaceFromDisk } from './workspace'

// ============================================================================
// Git module
// ============================================================================

// Git Models - Type definitions
export type { GitCommit, CreateGitCommitOptions } from './git/models/commit'
export type { GitTag, GitTagType, CreateLightweightTagOptions, CreateAnnotatedTagOptions } from './git/models/tag'
export type { GitRef, GitRefType, CreateGitRefOptions } from './git/models/ref'

// Git Models - Factory functions and utilities
export {
  createGitCommit as createGitCommitModel,
  isSameCommit,
  isMergeCommit,
  isRootCommit,
  extractScope,
  extractType,
} from './git/models/commit'
export {
  createLightweightTag,
  createAnnotatedTag,
  isAnnotatedTag,
  isLightweightTag,
  extractVersionFromTag,
  extractPackageFromTag,
  buildTagName,
  compareTagsByVersion,
} from './git/models/tag'
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
} from './git/models/ref'

// Git Operations - Log
export type { GitLogOptions } from './git/operations/log'
export {
  DEFAULT_LOG_OPTIONS,
  getCommitLog,
  getCommitsBetween,
  getCommitsSince,
  getCommit,
  commitExists,
  escapeGitRef,
  escapeGitPath,
  escapeGitArg,
} from './git/operations/log'

// Git Operations - Tag
export type { GitTagOptions, ListTagsOptions } from './git/operations/query-tags'
export type { CreateTagOptions } from './git/operations/manage-tags'
export {
  DEFAULT_TAG_OPTIONS,
  getTags,
  getTag,
  tagExists,
  getLatestTag,
  getTagsForPackage,
  escapeGitTagPattern,
} from './git/operations/query-tags'
export { createTag, deleteTag, pushTag, escapeGitMessage } from './git/operations/manage-tags'

// Git Operations - Commit
export type { GitCommitOptions, CreateCommitOptions } from './git/operations/commit'
export type { StageOptions } from './git/operations/stage'
export { DEFAULT_COMMIT_OPTIONS, commit, amendCommit, createEmptyCommit, escapeFilePath, escapeAuthor } from './git/operations/commit'
export { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges } from './git/operations/stage'
export { getHead, getCurrentBranch, hasUntrackedFiles } from './git/operations/head-info'

// Git Operations - Status
export type { GitStatusOptions, FileStatus, FileStatusEntry, RepositoryStatus } from './git/operations/status'
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
} from './git/operations/status'

// Git Client Factory
export type { GitClient, GitClientConfig } from './git/factory'
export { createGitClient, DEFAULT_GIT_CLIENT_CONFIG } from './git/factory'

// ============================================================================
// Flow module
// ============================================================================

// Flow Models - Type definitions
export type {
  FlowConfig,
  FlowContext,
  FlowResult,
  FlowState,
  FlowStatus,
  FlowStepResult,
  FlowStepResultWithId,
  Logger,
  FlowStep,
  StepCondition,
  StepExecutor,
  CreateStepOptions,
  VersionFlow,
  CreateFlowOptions,
} from './flow/models'

// Flow Models - Factory functions and constants
export { DEFAULT_FLOW_CONFIG, DEFAULT_CHANGELOG_FILENAME } from './flow/models'
export { createStep, createNoopStep, createSkippedResult, createSuccessResult, createFailedResult } from './flow/models'
export {
  createFlow,
  addStep,
  removeStep,
  insertStep,
  insertStepAfter,
  insertStepBefore,
  replaceStep,
  withConfig,
  getStep,
  hasStep,
} from './flow/models'

// Flow Executor
export type { ExecuteOptions } from './flow/executor'
export { executeFlow, dryRun, validateFlow } from './flow/executor'

// Flow Steps
export {
  FETCH_REGISTRY_STEP_ID,
  createFetchRegistryStep,
  ANALYZE_COMMITS_STEP_ID,
  createAnalyzeCommitsStep,
  CALCULATE_BUMP_STEP_ID,
  createCalculateBumpStep,
  createCheckIdempotencyStep,
  GENERATE_CHANGELOG_STEP_ID,
  createGenerateChangelogStep,
  createWriteChangelogStep,
  UPDATE_PACKAGES_STEP_ID,
  createUpdatePackageStep,
  createCascadeDependenciesStep,
  CREATE_COMMIT_STEP_ID,
  createGitCommitStep,
  CREATE_TAG_STEP_ID,
  createTagStep,
  createPushTagStep,
} from './flow/steps'

// Flow Presets
export {
  CONVENTIONAL_FLOW_CONFIG,
  createConventionalFlow,
  createMinimalFlow,
  createChangelogOnlyFlow,
  INDEPENDENT_FLOW_CONFIG,
  createIndependentFlow,
  createBatchReleaseFlow,
  createCheckDependentBumpsStep,
  SYNCED_FLOW_CONFIG,
  createSyncedFlow,
  createFixedVersionFlow,
  createSyncAllPackagesStep,
  createCombinedChangelogStep,
} from './flow/presets'

// Flow Factory
export type { FlowPreset } from './flow/factory'
export { createVersionFlow, createDryRunFlow, getAvailablePresets, getPresetDescription } from './flow/factory'
