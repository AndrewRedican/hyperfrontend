/**
 * NPM registry client with package escaping and in-memory caching.
 *
 * @module @hyperfrontend/versioning/registry/npm
 */
export type { Cache, CacheEntry } from './cache'
export { createNpmRegistry, escapePackageName, escapeVersion } from './client'
export { createCache } from './cache'
