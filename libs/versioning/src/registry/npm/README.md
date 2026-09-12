# npm

NPM registry client: fetches package metadata from a registry endpoint with in-memory caching and safe URL encoding.

`createNpmRegistry(config)` returns a registry binding that resolves packages via the standard `https://registry.npmjs.org/<package>` API. [`escapePackageName`](https://www.hyperfrontend.dev/docs/libraries/versioning/registry/npm/#api-escapePackageName) and [`escapeVersion`](https://www.hyperfrontend.dev/docs/libraries/versioning/registry/npm/#api-escapeVersion) produce URL-safe path segments for scoped packages and prerelease tags. The cache ([`createCache`](https://www.hyperfrontend.dev/docs/libraries/versioning/registry/npm/#api-createCache), [`Cache`](https://www.hyperfrontend.dev/docs/libraries/versioning/registry/npm/#api-Cache), [`CacheEntry`](https://www.hyperfrontend.dev/docs/libraries/versioning/registry/npm/#api-CacheEntry)) is a small TTL-bound in-memory store so repeated lookups within a release flow do not refetch the same package metadata.
