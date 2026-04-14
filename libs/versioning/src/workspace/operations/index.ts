/**
 * Workspace operations for cascade bumps, batch updates, and dependency reference management.
 *
 * @module @hyperfrontend/versioning/workspace/operations
 */
export type { BatchUpdateResult, UpdatedPackage, FailedUpdate, BatchUpdateOptions } from './batch-update'
export type { PlannedBump, BumpReason, CascadeBumpOptions, CascadeBumpResult, DirectBumpInput } from './cascade-bump'
export type { ValidationResult, ValidationReport, ValidationCheckResult } from './validate'
export {
  DEFAULT_BATCH_UPDATE_OPTIONS,
  applyBumps,
  updatePackageVersionInTree,
  updateDependencyReferencesInTree,
  summarizeBatchUpdate,
} from './batch-update'
export { DEFAULT_CASCADE_OPTIONS, calculateCascadeBumps, calculateCascadeBumpsFromPackage, summarizeCascadeBumps } from './cascade-bump'
export { validateWorkspace, validateProject, summarizeValidation } from './validate'
