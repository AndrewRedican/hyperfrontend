/**
 * Pre-configured release flows for conventional, independent, and synced release strategies.
 *
 * @module @hyperfrontend/versioning/flow/presets
 */
export { CONVENTIONAL_FLOW_CONFIG, createConventionalFlow, createMinimalFlow, createChangelogOnlyFlow } from './conventional'
export { INDEPENDENT_FLOW_CONFIG, createIndependentFlow, createBatchReleaseFlow, createCheckDependentBumpsStep } from './independent'
export {
  SYNCED_FLOW_CONFIG,
  createSyncedFlow,
  createFixedVersionFlow,
  createSyncAllPackagesStep,
  createCombinedChangelogStep,
} from './synced'
