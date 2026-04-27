# presets

Pre-configured release flows for the most common monorepo and single-package release strategies.

`createConventionalFlow` (plus `createMinimalFlow` and `createChangelogOnlyFlow`) covers single-package conventional-commit-driven releases. `createIndependentFlow` and `createBatchReleaseFlow` cover monorepos where each package versions independently; `createCheckDependentBumpsStep` is the cascade-bump helper that powers the dependent-package check. `createSyncedFlow`, `createFixedVersionFlow`, `createSyncAllPackagesStep`, and `createCombinedChangelogStep` cover monorepos that release all packages together at a synced version. Each preset exposes a `*_FLOW_CONFIG` constant alongside its factory so consumers can read the canonical step list before tweaking.
