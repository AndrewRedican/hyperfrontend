/**
 * Path manipulation utilities for joining, normalization, resolution, and segment extraction.
 *
 * @module @hyperfrontend/project-scope/core/path
 */
export type { ParsedPath } from './segments'
export { isWithinRoot } from './confine'
export { join, joinPosix } from './join'
export { ensureTrailingSlash, normalizePath, normalizeToForwardSlashes, normalizeToNative, removeTrailingSlash } from './normalize'
export { isAbsolute, joinPath, offsetFromRoot, relativePath, resolveFromWorkspace, resolvePath, resolveRealPath } from './resolve'
export { getBasename, getDirname, getExtension, getFileNameWithoutExtension, parsePath, pathSegments } from './segments'
