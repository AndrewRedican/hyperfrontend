import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createScopedLogger } from '../logger'
import { createFileSystemError } from './read'

const fsWriteLogger = createScopedLogger('project-scope:fs:write')

/**
 * Options for write operations.
 */
export interface WriteFileOptions {
  /** File encoding */
  encoding?: BufferEncoding
  /** File mode/permissions */
  mode?: number
}

/**
 * Options for JSON write operations.
 */
export interface WriteJsonOptions extends WriteFileOptions {
  /** Indentation spaces (default: 2) */
  indent?: number
}

/**
 * Ensure directory exists, create recursively if not.
 *
 * @param dirPath - Directory path to ensure exists
 *
 * @example Ensuring directory exists
 * ```typescript
 * ensureDir('./output/reports')
 * // Directory now exists (created if missing)
 * ```
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    fsWriteLogger.debug('Creating directory recursively', { path: dirPath })
    mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Write string content to file.
 * Creates parent directories if needed.
 *
 * @param filePath - Absolute or relative path to the target file
 * @param content - String content to write to the file
 * @param options - Optional write configuration (encoding, mode)
 * @throws {Error} If write fails
 *
 * @example Writing text content to file
 * ```typescript
 * import { writeFileContent } from '@hyperfrontend/project-scope'
 *
 * // Write a simple text file
 * writeFileContent('./output/data.txt', 'Hello, World!')
 *
 * // Write with custom encoding
 * writeFileContent('./output/data.txt', 'Content', { encoding: 'utf-8' })
 * ```
 */
export function writeFileContent(filePath: string, content: string, options?: WriteFileOptions): void {
  try {
    fsWriteLogger.debug('Writing file content', { path: filePath, size: content.length, encoding: options?.encoding ?? 'utf-8' })
    ensureDir(dirname(filePath))
    writeFileSync(filePath, content, {
      encoding: options?.encoding ?? 'utf-8',
      mode: options?.mode,
    })
    fsWriteLogger.debug('File written successfully', { path: filePath })
  } catch (error) {
    fsWriteLogger.warn('Failed to write file', { path: filePath, error: error instanceof Error ? error.message : String(error) })
    throw createFileSystemError(`Failed to write file: ${filePath}`, 'FS_WRITE_ERROR', { path: filePath, operation: 'write', cause: error })
  }
}

/**
 * Write Buffer to file.
 * Creates parent directories if needed.
 *
 * @param filePath - Absolute or relative path to the target file
 * @param content - Buffer containing binary data to write
 * @param options - Optional write configuration (mode)
 * @throws {Error} If write fails
 *
 * @example Writing binary buffer to file
 * ```typescript
 * const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])
 * writeFileBuffer('./output/image.png', imageBuffer)
 * ```
 */
export function writeFileBuffer(filePath: string, content: Buffer, options?: WriteFileOptions): void {
  try {
    fsWriteLogger.debug('Writing file buffer', { path: filePath, size: content.length })
    ensureDir(dirname(filePath))
    writeFileSync(filePath, content, { mode: options?.mode })
    fsWriteLogger.debug('Buffer written successfully', { path: filePath })
  } catch (error) {
    fsWriteLogger.warn('Failed to write buffer', { path: filePath, error: error instanceof Error ? error.message : String(error) })
    throw createFileSystemError(`Failed to write file: ${filePath}`, 'FS_WRITE_ERROR', { path: filePath, operation: 'write', cause: error })
  }
}

/**
 * Minimal shape used to inspect the Node.js `code` property on filesystem errors
 * without importing the full `NodeJS.ErrnoException` type.
 */
type ErrorWithCode = {
  /** Error code */
  code?: string
}

/**
 * Write JSON data to file with formatting.
 * Creates parent directories if needed.
 *
 * @param filePath - Absolute or relative path to the target JSON file
 * @param data - Object or value to serialize as JSON
 * @param options - Optional write configuration (indent, encoding, mode)
 * @throws {Error} If write fails
 *
 * @example Writing JSON data to file
 * ```typescript
 * import { writeJsonFile } from '@hyperfrontend/project-scope'
 *
 * // Write object to JSON file
 * writeJsonFile('./config.json', { port: 3000, debug: true })
 *
 * // Write with custom indentation
 * writeJsonFile('./config.json', data, { indent: 4 })
 * ```
 */
export function writeJsonFile<T>(filePath: string, data: T, options?: WriteJsonOptions): void {
  try {
    fsWriteLogger.debug('Writing JSON file', { path: filePath, indent: options?.indent ?? 2 })
    const indent = options?.indent ?? 2
    const content = stringify(data, null, indent) + '\n'
    writeFileContent(filePath, content, options)
    fsWriteLogger.debug('JSON file written successfully', { path: filePath })
  } catch (error) {
    if ((<ErrorWithCode>error)?.code === 'FS_WRITE_ERROR') {
      throw error
    }
    fsWriteLogger.warn('Failed to write JSON file', { path: filePath, error: error instanceof Error ? error.message : String(error) })
    throw createFileSystemError(`Failed to write JSON file: ${filePath}`, 'FS_WRITE_ERROR', {
      path: filePath,
      operation: 'write',
      cause: error,
    })
  }
}
