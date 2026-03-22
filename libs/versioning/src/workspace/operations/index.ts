/**
 * Workspace Operations
 *
 * Operations for managing workspace packages, versions, and dependencies.
 */

// Cascade bump
export type { PlannedBump, BumpReason, CascadeBumpOptions, CascadeBumpResult, DirectBumpInput } from './cascade-bump'
export { DEFAULT_CASCADE_OPTIONS, calculateCascadeBumps, calculateCascadeBumpsFromPackage, summarizeCascadeBumps } from './cascade-bump'

// Batch update
export type { BatchUpdateResult, UpdatedPackage, FailedUpdate, BatchUpdateOptions } from './batch-update'
export {
  DEFAULT_BATCH_UPDATE_OPTIONS,
  applyBumps,
  updatePackageVersionInTree,
  updateDependencyReferencesInTree,
  summarizeBatchUpdate,
} from './batch-update'

// Validation
export type { ValidationResult, ValidationReport, ValidationCheckResult } from './validate'
export { validateWorkspace, validateProject, summarizeValidation } from './validate'
