/**
 * Per-format pre-pass + externalize plugin that bundle each third-party dep once
 * into `_dependencies/<dep>/`, then route every entry's import of that dep at a
 * relative path. Locked per Decision #38 (overview).
 *
 * @module @hyperfrontend/builder/bundle/dependencies
 */
export type { ExternalizeBundledDepsPluginOptions, ExternalizeFormat } from './externalize-plugin'
export type { PrePassJob, PrePassResult, RunPrePassOptions } from './pre-pass'
export type { ResolveBundledDepsOptions } from './resolve-bundled-deps'
export type { PrePassWorkerJob, PrePassWorkerReport } from './worker'
export { createExternalizeBundledDepsPlugin, relativeImport } from './externalize-plugin'
export { resolveDefaultWorkerPath, runPrePass } from './pre-pass'
export { resolveBundledDeps } from './resolve-bundled-deps'
export { runPrePassWorkerJob } from './worker'
