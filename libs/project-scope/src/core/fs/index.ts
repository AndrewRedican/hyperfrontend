/**
 * Filesystem operations for reading/writing files, directory traversal, and stat checks.
 *
 * @module @hyperfrontend/project-scope/core/fs
 */
export type { FileSystemErrorCode, FileSystemErrorContext, ReadJsonFileOptions } from './read'
export { createFileSystemError, readFileBuffer, readFileContent, readFileIfExists, readJsonFile, readJsonFileIfExists } from './read'
export type { WriteFileOptions, WriteJsonOptions } from './write'
export { ensureDir, writeFileBuffer, writeFileContent, writeJsonFile } from './write'
export type { FileStats } from './stat'
export { exists, getFileStat, isDirectory, isFile, isSymlink } from './stat'
export type { DirectoryEntry, RecursiveOptions } from './directory'
export { createDirectory, readDirectory, readDirectoryRecursive, removeDirectory } from './directory'
export { findUpwardWhere, locateByMarkers, traverseUpward } from './traversal'
