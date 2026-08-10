/**
 * Per-format pre-pass and externalize plugin that bundle each third-party (and
 * workspace) dep once, then reroute every entry's import to it.
 *
 * @module @hyperfrontend/builder/bundle/dependencies
 */
export type { ExternalizeBundledDepsPluginOptions, ExternalizeFormat, WorkspaceBundledDepRoute } from './externalize-plugin'
export type { PrePassJob, PrePassJobKind, PrePassResult, RunPrePassOptions } from './pre-pass'
export type { ChunkFormat } from './prune/used-exports'
export type { ResolveBundledDepsOptions } from './resolve-bundled-deps'
export type { ResolvedWorkspaceDepEntry, ResolveWorkspaceBundledDepsOptions } from './resolve-workspace-bundled-deps'
export type { PrePassWorkerJob, PrePassWorkerReport } from './worker'
export { buildWorkspaceRoutes, createExternalizeBundledDepsPlugin, relativeImport } from './externalize-plugin'
export { resolveDefaultWorkerPath, runPrePass } from './pre-pass'
export { resolveBundledDeps } from './resolve-bundled-deps'
export { loadWorkspacePathMappings, resolveWorkspaceBundledDeps } from './resolve-workspace-bundled-deps'
export { runPrePassWorkerJob } from './worker'
