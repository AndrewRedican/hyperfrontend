/**
 * Core utilities for filesystem, path manipulation, platform detection, and encoding.
 *
 * @module @hyperfrontend/project-scope/core
 */
export type { Cache, CacheOptions } from './cache'
export type { EncodingInfo } from './encoding'
export type { StructuredError } from './errors/structured-errors'
export type {
  DirectoryEntry,
  FileStats,
  FileSystemErrorCode,
  FileSystemErrorContext,
  ReadJsonFileOptions,
  RecursiveOptions,
  WriteFileOptions,
  WriteJsonOptions,
} from './fs'
export type { LogLevel, ScopedLogger, ScopedLoggerOptions } from './logger'
export type { ParsedPath } from './path'
export type { DetectedLineEnding, LineEndingStyle, PlatformInfo } from './platform'
export { clearAllCaches, createCache, getCacheCount, memoize, unregisterCache } from './cache'
export {
  addBom,
  BINARY_SIGNATURES,
  bufferToString,
  detectEncoding,
  detectEncodingInfo,
  hasBom,
  isTextFile,
  stripBom,
  toUtf8,
  UTF8_BOM,
  UTF8_BOM_BYTES,
  UTF16_BE_BOM_BYTES,
  UTF16_LE_BOM_BYTES,
} from './encoding'
export {
  createConfigError,
  createFsError,
  createParseError,
  createStructuredError,
  createValidationError,
} from './errors/structured-errors'
export {
  createDirectory,
  createFileSystemError,
  ensureDir,
  exists,
  findUpwardWhere,
  getFileStat,
  isDirectory,
  isFile,
  isSymlink,
  locateByMarkers,
  readDirectory,
  readDirectoryRecursive,
  readFileBuffer,
  readFileContent,
  readFileIfExists,
  readJsonFile,
  readJsonFileIfExists,
  removeDirectory,
  traverseUpward,
  writeFileBuffer,
  writeFileContent,
  writeJsonFile,
} from './fs'
export { createScopedLogger, getGlobalLogLevel, logger, resetGlobalLogLevel, sanitize, setGlobalLogLevel } from './logger'
export {
  ensureTrailingSlash,
  getBasename,
  getDirname,
  getExtension,
  getFileNameWithoutExtension,
  isAbsolute,
  join,
  joinPath,
  joinPosix,
  normalizePath,
  normalizeToForwardSlashes,
  normalizeToNative,
  offsetFromRoot,
  parsePath,
  pathSegments,
  relativePath,
  removeTrailingSlash,
  resolveFromWorkspace,
  resolvePath,
  resolveRealPath,
} from './path'
export { matchesAnyPattern, matchesExact, matchGlobPattern } from './patterns/glob'
export {
  CRLF,
  detectCaseSensitivity,
  detectLineEnding,
  detectPlatform,
  getLineEnding,
  getPathSeparator,
  getPlatformInfo,
  isCaseSensitiveFs,
  isWindows,
  LF,
  normalizeLineEndings,
  pathsEqual,
} from './platform'
