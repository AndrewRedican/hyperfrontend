/**
 * Interactive commit authoring session: prompt-driven step sequence that
 * produces a validated conventional commit message and (by default) runs
 * `git commit`. See `./README.md` for architecture overview.
 *
 * @module @hyperfrontend/versioning/commits/author
 */
export type { LoadCommitConfigOptions, LoadedCommitConfig } from './config-loader/load'
export type {
  CommitExecutor,
  PartialSessionConfig,
  ScopeFilterContext,
  SessionConfig,
  SessionType,
  StagedPathsProvider,
} from './models/session-config'
export type { SessionContext } from './models/session-context'
export type { SessionOutcome, SessionStatus } from './models/session-outcome'
export type { Step, StepResult, StepStatus } from './models/step'
export type { DiscoveredScope, DiscoverScopesOptions } from './resolvers/scope-discovery'
export type { StagedPathsOptions } from './resolvers/staged-paths'
export type { AuthorSession, CreateAuthorSessionOptions } from './session/create-session'
export { CONFIG_FILE_NAMES, loadCommitConfig } from './config-loader/load'
export { typeToChoice } from './models/session-config'
export { createSessionContext } from './models/session-context'
export { SessionStatus as SessionStatusValues } from './models/session-outcome'
export { StepStatus as StepStatusValues, cancelled, done, goto } from './models/step'
export { conventionalPreset } from './presets/conventional'
export { defaultScope } from './resolvers/default-scope'
export { discoverScopes } from './resolvers/scope-discovery'
export { getStagedPaths } from './resolvers/staged-paths'
export { createAuthorSession } from './session/create-session'
export { DEFAULT_SESSION_TYPES, resolveSessionConfig } from './session/resolve-config'
export { runAuthorSession } from './session/run-session'
export { bodyStep } from './steps/body'
export { breakingStep } from './steps/breaking'
export { commitStep } from './steps/commit'
export { issuesStep, parseReferences } from './steps/issues'
export { PREVIEW_RESTART_STEP_ID, previewStep } from './steps/preview'
export { EMPTY_STAGING_MESSAGE, resolveScopeStep } from './steps/resolve-scope'
export { NO_SCOPE_CANDIDATES_MESSAGE, scopeStep } from './steps/scope'
export { normalizeSubject, subjectStep } from './steps/subject'
export { typeStep } from './steps/type'
