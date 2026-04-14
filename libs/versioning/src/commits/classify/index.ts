/**
 * Commit classification logic for matching commits to project scopes and infrastructure changes.
 *
 * @module @hyperfrontend/versioning/commits/classify
 */
export type { InfrastructureConfig, InfrastructureMatchContext, InfrastructureMatcher } from './infrastructure'
export type {
  ClassificationContext,
  ClassificationResult,
  ClassificationSummary,
  ClassifiedCommit,
  CommitSource,
  CommitWithRaw,
} from './models'
export type { DeriveProjectScopesOptions } from './project-scopes'
export {
  classifyCommit,
  classifyCommits,
  createClassificationContext,
  extractConventionalCommits,
  filterIncluded,
  toChangelogCommit,
} from './classifier'
export {
  scopeMatcher,
  scopePrefixMatcher,
  scopeRegexMatcher,
  messageMatcher,
  anyOf,
  allOf,
  not,
  CI_SCOPE_MATCHER,
  TOOLING_SCOPE_MATCHER,
  TOOL_PREFIX_MATCHER,
  DEFAULT_INFRA_SCOPE_MATCHER,
  buildInfrastructureMatcher,
  createMatchContext,
  evaluateInfrastructure,
} from './infrastructure'
export { createClassifiedCommit, createEmptyClassificationSummary } from './models'
export {
  DEFAULT_EXCLUDE_SCOPES,
  DEFAULT_PROJECT_PREFIXES,
  deriveProjectScopes,
  scopeIsExcluded,
  scopeMatchesProject,
} from './project-scopes'
