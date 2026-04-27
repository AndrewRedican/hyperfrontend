# operations

Workspace-wide operations: cascade bumps, batch updates, dependency-reference rewriting, and validation.

The cascade-bump family (`PlannedBump`, `BumpReason`, `CascadeBumpOptions`, `CascadeBumpResult`, `DirectBumpInput`) plans the propagation of a version bump through a monorepo's internal-dependency graph, so that bumping a base package automatically schedules dependent packages with the right `BumpReason`. The batch-update family (`applyBumps`, `updatePackageVersionInTree`, `updateDependencyReferencesInTree`, `summarizeBatchUpdate`, plus `BatchUpdateResult`, `UpdatedPackage`, `FailedUpdate`, `BatchUpdateOptions`, `DEFAULT_BATCH_UPDATE_OPTIONS`) carries out the planned bumps across `package.json` files in one transactional pass. The validation family (`ValidationResult`, `ValidationReport`, `ValidationCheckResult`) verifies that a planned set of changes is internally consistent before any file is written.
