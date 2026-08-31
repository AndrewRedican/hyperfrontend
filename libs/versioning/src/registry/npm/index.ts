/**
 * NPM registry client with package escaping and in-memory caching.
 *
 * @module @hyperfrontend/versioning/registry/npm
 */
export type { Cache, CacheEntry } from './cache'
export type { NpmLookupFailure, AbsentLookupFailure, UnavailableLookupFailure } from './classify-error'
export { createCache } from './cache'
export { classifyNpmError } from './classify-error'
export { createNpmRegistry, escapePackageName, escapeVersion } from './client'
