/**
 * Bundle phase orchestrator: entry discovery, externals, Rollup, and
 * declaration emission, run in order via {@link runBundlePhase}.
 *
 * @module @hyperfrontend/builder/bundle
 */
export type { WorkerInvocation } from './worker-locator'
export { runBundlePhase } from './run-bundle-phase'
