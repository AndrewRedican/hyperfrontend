export type {
  ClassificationContext,
  ClassificationResult,
  ClassificationSummary,
  ClassifiedCommit,
  CommitSource,
  CommitWithRaw,
} from './models'
export type { DeriveProjectScopesOptions } from './project-scopes'
export { createClassifiedCommit, createEmptyClassificationSummary } from './models'
export {
  classifyCommit,
  classifyCommits,
  createClassificationContext,
  extractConventionalCommits,
  filterIncluded,
  toChangelogCommit,
} from './classifier'
export { DEFAULT_EXCLUDE_SCOPES, deriveProjectScopes, scopeIsExcluded, scopeMatchesProject } from './project-scopes'
