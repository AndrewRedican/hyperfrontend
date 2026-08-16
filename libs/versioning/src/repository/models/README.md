# models

Repository data models: platforms, configurations, and inference results.

`RepositoryPlatform` plus `KnownPlatform`, `PLATFORM_HOSTNAMES`, `isKnownPlatform`, and `detectPlatformFromHostname` cover the supported source-code platforms (GitHub, GitLab, Bitbucket, Azure DevOps). `RepositoryConfig` (built via `createRepositoryConfig`, validated via `isRepositoryConfig`) carries the platform, owner, repo name, and the `CompareUrlFormatter` that produces version-diff URLs. `RepositoryResolution` (with `createDisabledResolution`, `createExplicitResolution`, `createInferredResolution`) captures how a resolution was reached: explicitly configured, inferred from `package.json`, or deliberately disabled.
