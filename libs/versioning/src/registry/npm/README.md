# npm

NPM registry client: fetches package metadata from a registry endpoint with in-memory caching and safe URL encoding.

`createNpmRegistry(config)` returns a registry binding that resolves packages via the standard `https://registry.npmjs.org/<package>` API. `escapePackageName` and `escapePackageVersion` produce URL-safe path segments for scoped packages and prerelease tags. The cache (`createCache`, `Cache`, `CacheEntry`) is a small TTL-bound in-memory store so repeated lookups within a release flow do not refetch the same package metadata.
