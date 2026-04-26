# steps

Reusable flow-step factories — the building blocks that the `flow/presets` family composes into release pipelines.

`createFetchRegistryStep`, `createAnalyzeCommitsStep`, `createCalculateBumpStep`, `createCheckIdempotencyStep`, `createGenerateChangelogStep`, `createWriteChangelogStep`, `createGitCommitStep`, `createTagStep`, and `createPushTagStep` each return a `FlowStep` with a stable, exported step ID (`FETCH_REGISTRY_STEP_ID`, `ANALYZE_COMMITS_STEP_ID`, etc.) so consumers can reference, replace, or position individual steps inside custom flows. `DEFAULT_COMMIT_TYPE_TO_SECTION` is the conventional mapping from commit types to changelog sections used by the changelog-generation step.
