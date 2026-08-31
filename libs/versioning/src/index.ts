/**
 * Version management toolkit with semver, changelog, git operations, and workspace coordination.
 *
 * @module @hyperfrontend/versioning
 */
export type { ChangelogDiff, DiffStats, EntryDiff, SectionDiff, ItemDiff, PropertyDiff } from './changelog/compare'
export type { Changelog, ChangelogFormat, ChangelogHeader, ChangelogLink, ChangelogMetadata } from './changelog/models/changelog'
export type { CommitRef, IssueRef } from './changelog/models/commit-ref'
export type { ChangelogEntry, ChangelogItem, ChangelogSection } from './changelog/models/entry'
export type { CompatibilityResult, SchemaDifference } from './changelog/models/schema'
export type { ChangelogSectionType } from './changelog/models/section'
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
export type { Token, TokenType } from './changelog/parse/tokenizer'
export type { SerializeOptions, JsonSerializeOptions } from './changelog/serialize'
export type {
  AuthorSession,
  CommitExecutor,
  CreateAuthorSessionOptions,
  DiscoverScopesOptions,
  DiscoveredScope,
  LoadCommitConfigOptions,
  LoadedCommitConfig,
  PartialSessionConfig,
  ScopeFilterContext,
  SessionConfig,
  SessionContext,
  SessionOutcome,
  SessionStatus,
  SessionType,
  StagedPathsOptions,
  StagedPathsProvider,
  Step,
  StepResult,
  StepStatus,
} from './commits/author'
export type { CommitDraft } from './commits/format/models/draft'
export type { BreakingChange } from './commits/models/breaking'
export type { CommitType } from './commits/models/commit-type'
export type { ConventionalCommit, CommitFooter } from './commits/models/conventional'
export type { ParsedBody } from './commits/parse/body'
export type { ParsedFooters } from './commits/parse/footer'
export type { ParsedHeader } from './commits/parse/header'
export type {
  HeaderMaxLengthOptions,
  ImperativeMoodOptions,
  Rule,
  RuleConfig,
  RuleContext,
  RuleLevel,
  RuleMessage,
  RuleResult,
  Ruleset,
  ScopeEnumOptions,
  SubjectCase,
  SubjectCaseOptions,
  TypeEnumOptions,
  ValidationResult as CommitValidationResult,
} from './commits/validate'
export type { ExecuteOptions } from './flow/executor'
export type { FlowPreset } from './flow/factory'
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
export type { GitClient, GitClientConfig } from './git/factory'
export type { GitCommit, CreateGitCommitOptions } from './git/models/commit'
export type { GitRef, GitRefType, CreateGitRefOptions } from './git/models/ref'
export type { GitTag, GitTagType, CreateLightweightTagOptions, CreateAnnotatedTagOptions } from './git/models/tag'
export type { GitCommitOptions, CreateCommitOptions } from './git/operations/commit'
export type { FileChangeStatus, FileChange, DiffOptions, GitCommitWithFiles } from './git/operations/diff'
export type { GitLogOptions } from './git/operations/log'
export type { CreateTagOptions } from './git/operations/manage-tags'
export type { GitOperationState, GitOperationStateReason, GitOperationStateOptions } from './git/operations/operation-state'
export type { GitTagOptions, ListTagsOptions } from './git/operations/query-tags'
export type { StageOptions } from './git/operations/stage'
export type { GitStatusOptions, FileStatus, FileStatusEntry, RepositoryStatus } from './git/operations/status'
export type { RegistryType } from './registry/factory'
export type { PackageInfo } from './registry/models/package-info'
export type { Registry, RegistryConfig } from './registry/models/registry'
export type { RegistryFailureReason, RegistryUnavailableError, RegistryUnavailableDetails } from './registry/models/registry-error'
export type { VersionInfo, Maintainer } from './registry/models/version-info'
export type { Cache, CacheEntry } from './registry/npm/cache'
export type { NpmLookupFailure, AbsentLookupFailure, UnavailableLookupFailure } from './registry/npm/classify-error'
export type {
  CompareUrlFormatter,
  CreateCompareUrlOptions,
  CreateRepositoryConfigOptions,
  KnownPlatform,
  PackageJsonForRepository,
  PackageJsonRepository,
  ParsedRepository,
  RepositoryConfig,
  RepositoryInferenceSource,
  RepositoryPlatform,
  RepositoryResolution,
  RepositoryResolutionMode,
} from './repository'
export type { Range, Comparator, ComparatorSet, RangeOperator } from './semver/models/range'
export type { SemVer, BumpType } from './semver/models/version'
export type { ParseRangeResult } from './semver/parse/range'
export type { ParseVersionResult } from './semver/parse/version'
export type { DependencyGraph, DependencyType, DependencyEdge, DependencyGraphAnalysis } from './workspace/discovery/dependencies'
export type { DiscoveredChangelog } from './workspace/discovery/discover-changelogs'
export type { DiscoveryOptions, DiscoveryResult } from './workspace/discovery/packages'
export type { Project, CreateProjectOptions } from './workspace/models/project'
export type { Workspace, WorkspaceConfig, WorkspaceType } from './workspace/models/workspace'
export type { BatchUpdateResult, UpdatedPackage, FailedUpdate, BatchUpdateOptions } from './workspace/operations/batch-update'
export type { PlannedBump, BumpReason, CascadeBumpOptions, CascadeBumpResult, DirectBumpInput } from './workspace/operations/cascade-bump'
export type {
  ValidationResult as WorkspaceValidationResult,
  ValidationReport,
  ValidationCheckResult,
} from './workspace/operations/validate'
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
export { createChangelog, createChangelogLink, createEmptyChangelog } from './changelog/models/changelog'
export { createCommitRef, createIssueRef, getShortHash } from './changelog/models/commit-ref'
export { createChangelogEntry, createChangelogItem, createChangelogSection, createUnreleasedEntry } from './changelog/models/entry'
export { changelogSchema, validateChangelog, checkSchemaCompatibility } from './changelog/models/schema'
export { getSectionType, SECTION_HEADINGS, SECTION_TYPE_MAP } from './changelog/models/section'
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
export { parseVersionFromHeading, parseCommitRefs, parseIssueRefs, parseScopeFromItem } from './changelog/parse/line'
export { parseChangelog } from './changelog/parse/parser'
export { tokenize } from './changelog/parse/tokenizer'
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
export {
  CONFIG_FILE_NAMES,
  DEFAULT_SESSION_TYPES,
  EMPTY_STAGING_MESSAGE,
  NO_SCOPE_CANDIDATES_MESSAGE,
  PREVIEW_RESTART_STEP_ID,
  SessionStatusValues,
  StepStatusValues,
  bodyStep,
  breakingStep,
  cancelled,
  commitStep,
  conventionalStepPreset,
  createAuthorSession,
  createSessionContext,
  defaultScope,
  discoverScopes,
  done,
  getStagedPaths,
  goto,
  issuesStep,
  loadCommitConfig,
  normalizeSubject,
  parseReferences,
  previewStep,
  resolveScopeStep,
  resolveSessionConfig,
  runAuthorSession,
  scopeStep,
  subjectStep,
  typeStep,
  typeToChoice,
} from './commits'
export { DEFAULT_EXCLUDE_SCOPES, DEFAULT_PROJECT_PREFIXES } from './commits/classify'
export { countHeaderLength } from './commits/format/count-header'
export { formatHeader } from './commits/format/format-header'
export { formatCommitMessage } from './commits/format/format-message'
export { toDraft } from './commits/format/models/draft'
export { createBreakingFromFooter, createBreakingFromSubject, createNonBreaking, isBreakingFooterKey } from './commits/models/breaking'
export {
  COMMIT_TYPES,
  getSemverBump,
  isReleaseType,
  isStandardType,
  MINOR_TYPES,
  PATCH_TYPES,
  RELEASE_TYPES,
} from './commits/models/commit-type'
export { createCommitFooter, createConventionalCommit } from './commits/models/conventional'
export { parseBody } from './commits/parse/body'
export { parseFooters } from './commits/parse/footer'
export { parseHeader } from './commits/parse/header'
export { parseConventionalCommit, isConventionalCommit } from './commits/parse/message'
export {
  BUILT_IN_RULES,
  CONVENTIONAL_TYPES,
  conventionalPreset,
  DEFAULT_IMPERATIVE_WORDLIST,
  headerMaxLengthRule,
  imperativeMoodRule,
  scopeEnumRule,
  subjectCaseRule,
  subjectEmptyRule,
  typeEnumRule,
  validateCommit,
  validateCommitMessage,
  validateCommitWithRules,
} from './commits/validate'
export { executeFlow, dryRun, validateFlow } from './flow/executor'
export { createVersionFlow, createDryRunFlow, getAvailablePresets, getPresetDescription } from './flow/factory'
export {
  DEFAULT_FLOW_CONFIG,
  DEFAULT_CHANGELOG_FILENAME,
  createStep,
  createNoopStep,
  createSkippedResult,
  createSuccessResult,
  createFailedResult,
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
export {
  DEFAULT_COMMIT_TYPE_TO_SECTION,
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
export { createGitClient, DEFAULT_GIT_CLIENT_CONFIG } from './git/factory'
export {
  createGitCommit as createGitCommitModel,
  isSameCommit,
  isMergeCommit,
  isRootCommit,
  extractScope,
  extractType,
} from './git/models/commit'
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
export { DEFAULT_COMMIT_OPTIONS, commit, amendCommit, createEmptyCommit, escapeFilePath, escapeAuthor } from './git/operations/commit'
export { DEFAULT_DIFF_OPTIONS, getChangedFilesBetween, getChangedFilesBetweenWithStatus, getCommitWithFiles } from './git/operations/diff'
export { getHead, getCurrentBranch, hasUntrackedFiles } from './git/operations/head-info'
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
export { createTag, deleteTag, pushTag, escapeGitMessage } from './git/operations/manage-tags'
export { getOperationState, isOperationInProgress, DEFAULT_OPERATION_STATE_OPTIONS } from './git/operations/operation-state'
export {
  DEFAULT_TAG_OPTIONS,
  getTags,
  getTag,
  tagExists,
  getLatestTag,
  getTagsForPackage,
  escapeGitTagPattern,
} from './git/operations/query-tags'
export { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges } from './git/operations/stage'
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
export { createRegistry } from './registry/factory'
export { createPackageInfo } from './registry/models/package-info'
export { REGISTRY_UNAVAILABLE_ERROR, createRegistryUnavailableError, isRegistryUnavailableError } from './registry/models/registry-error'
export { createVersionInfo } from './registry/models/version-info'
export { createCache } from './registry/npm/cache'
export { classifyNpmError } from './registry/npm/classify-error'
export { createNpmRegistry, escapePackageName, escapeVersion } from './registry/npm/client'
export {
  createCompareUrl,
  createDisabledResolution,
  createExplicitResolution,
  createInferredResolution,
  createRepositoryConfig,
  createRepositoryConfigFromUrl,
  DEFAULT_INFERENCE_ORDER,
  detectPlatformFromHostname,
  extractRepositoryUrl,
  inferRepositoryFromPackageJson,
  inferRepositoryFromPackageJsonObject,
  isKnownPlatform,
  isRepositoryConfig,
  isRepositoryResolution,
  parseRepositoryUrl,
  PLATFORM_HOSTNAMES,
} from './repository'
export { compare, eq, lt, lte, gt, gte, neq, satisfies, satisfiesComparator, maxSatisfying, minSatisfying } from './semver/compare/compare'
export { sort, sortDescending, max, min } from './semver/compare/sort'
export { format, formatSimple, formatRange, formatComparator } from './semver/format/to-string'
export { increment, incrementPrerelease, diff } from './semver/increment/bump'
export { createComparator, createComparatorSet, createRange, createAnyRange, createExactRange, isWildcard } from './semver/models/range'
export {
  createSemVer,
  createInitialVersion,
  createFirstRelease,
  isPrerelease,
  isStable,
  stripBuild,
  stripPrerelease,
} from './semver/models/version'
export { parseRange, parseRangeStrict } from './semver/parse/range'
export { parseVersion, parseVersionStrict, coerceVersion } from './semver/parse/version'
export { createWorkspaceFromDisk } from './workspace'
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
export { CHANGELOG_NAMES, findChangelogs, findProjectChangelog, discoverAllChangelogs } from './workspace/discovery/discover-changelogs'
export { discoverPackages, discoverProject, discoverProjectByName } from './workspace/discovery/packages'
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
  DEFAULT_BATCH_UPDATE_OPTIONS,
  applyBumps,
  updatePackageVersionInTree,
  summarizeBatchUpdate,
} from './workspace/operations/batch-update'
export {
  DEFAULT_CASCADE_OPTIONS,
  calculateCascadeBumps,
  calculateCascadeBumpsFromPackage,
  summarizeCascadeBumps,
} from './workspace/operations/cascade-bump'
export { validateWorkspace, validateProject, summarizeValidation } from './workspace/operations/validate'
