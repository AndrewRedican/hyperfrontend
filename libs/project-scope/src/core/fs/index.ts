/**
 * Filesystem operations for reading/writing files, directory traversal, and stat checks.
 *
 * @module @hyperfrontend/project-scope/core/fs
 */
export type { DirectoryEntry, RecursiveOptions } from './directory'
export type { FileSystemErrorCode, FileSystemErrorContext, ReadJsonFileOptions } from './read'
export type { FileStats } from './stat'
export type { WriteFileOptions, WriteJsonOptions } from './write'
export { createDirectory, readDirectory, readDirectoryRecursive, removeDirectory } from './directory'
export { createFileSystemError, readFileBuffer, readFileContent, readFileIfExists, readJsonFile, readJsonFileIfExists } from './read'
export { exists, getFileStat, isDirectory, isFile, isSymlink } from './stat'
export { findUpwardWhere, locateByMarkers, traverseUpward } from './traversal'
export { ensureDir, writeFileBuffer, writeFileContent, writeJsonFile } from './write'
