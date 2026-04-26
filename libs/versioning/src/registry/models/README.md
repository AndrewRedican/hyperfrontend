# models

Registry data models: registries themselves, package metadata, version metadata, and maintainer records.

`Registry` and `RegistryConfig` describe a configured registry endpoint (URL, scope, auth headers) used by the registry clients. `PackageInfo` (built via `createPackageInfo`) carries package-level metadata: name, dist-tags, versions list. `VersionInfo` (built via `createVersionInfo`) carries per-version metadata: version string, dependency declarations, dist (tarball + integrity), and `Maintainer[]`. The factories produce normalized objects regardless of the registry's exact payload shape so downstream code can rely on a single model.
