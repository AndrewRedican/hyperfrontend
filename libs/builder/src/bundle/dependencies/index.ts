/**
 * Per-format pre-pass + externalize plugin that bundle each third-party dep once
 * into `_dependencies/<dep>/`, then route every entry's import of that dep at a
 * relative path. The pattern is extended to workspace `@hyperfrontend/*` deps
 * via `resolveWorkspaceBundledDeps` and the workspace-aware externalize routes.
 *
 * @module @hyperfrontend/builder/bundle/dependencies
 */
export type { ExternalizeBundledDepsPluginOptions, ExternalizeFormat, WorkspaceBundledDepRoute } from './externalize-plugin'
export type { PrePassJob, PrePassJobKind, PrePassResult, RunPrePassOptions } from './pre-pass'
export type { ResolveBundledDepsOptions } from './resolve-bundled-deps'
export type { ResolvedWorkspaceDepEntry, ResolveWorkspaceBundledDepsOptions } from './resolve-workspace-bundled-deps'
export type { PrePassWorkerJob, PrePassWorkerReport } from './worker'
export { buildWorkspaceRoutes, createExternalizeBundledDepsPlugin, relativeImport } from './externalize-plugin'
export { resolveDefaultWorkerPath, runPrePass } from './pre-pass'
export { resolveBundledDeps } from './resolve-bundled-deps'
export { loadWorkspacePathMappings, resolveWorkspaceBundledDeps } from './resolve-workspace-bundled-deps'
export { runPrePassWorkerJob } from './worker'
