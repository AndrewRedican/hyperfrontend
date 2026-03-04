import { readFileSync, existsSync } from 'node:fs'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { defineProperties } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createScopedLogger } from '../logger'

const fsLogger = createScopedLogger('project-scope:fs')

/**
 * Error codes for file system operations.
 */
export type FileSystemErrorCode = 'FS_NOT_FOUND' | 'FS_READ_ERROR' | 'FS_WRITE_ERROR' | 'FS_PARSE_ERROR' | 'FS_NOT_A_DIRECTORY'

/**
 * File system error with code and context.
 */
export interface FileSystemErrorContext {
  path: string
  operation: 'read' | 'write' | 'stat' | 'readdir'
  cause?: unknown
}

/**
 * Create a file system error with code and context.
 *
 * @param message - The error message describing what went wrong
 * @param code - The category code for this type of filesystem failure
 * @param context - Additional context including path, operation, and cause
 * @returns A configured Error object with code and context properties
 */
export function createFileSystemError(message: string, code: FileSystemErrorCode, context: FileSystemErrorContext): Error {
  const error = createError(message)
  defineProperties(error, {
    code: { value: code, enumerable: true },
    context: { value: context, enumerable: true },
  })
  return error
}

/**
 * Read file contents as string.
 *
 * @param filePath - Path to file
 * @param encoding - File encoding (default: utf-8)
 * @returns File contents as string
 * @throws {Error} If file doesn't exist or can't be read
 *
 * @example
 * ```typescript
 * import { readFileContent } from '@hyperfrontend/project-scope'
 *
 * const content = readFileContent('./package.json')
 * console.log(content) // JSON string
 * ```
 */
export function readFileContent(filePath: string, encoding: BufferEncoding = 'utf-8'): string {
  if (!existsSync(filePath)) {
    fsLogger.debug('File not found', { path: filePath })
    throw createFileSystemError(`File not found: ${filePath}`, 'FS_NOT_FOUND', { path: filePath, operation: 'read' })
  }

  try {
    return readFileSync(filePath, { encoding })
  } catch (error) {
    fsLogger.warn('Failed to read file', { path: filePath })
    throw createFileSystemError(`Failed to read file: ${filePath}`, 'FS_READ_ERROR', { path: filePath, operation: 'read', cause: error })
  }
}

/**
 * Read file contents as Buffer.
 *
 * @param filePath - Path to file
 * @returns File contents as Buffer
 * @throws {Error} If file doesn't exist or can't be read
 */
export function readFileBuffer(filePath: string): Buffer {
  if (!existsSync(filePath)) {
    throw createFileSystemError(`File not found: ${filePath}`, 'FS_NOT_FOUND', { path: filePath, operation: 'read' })
  }

  try {
    return readFileSync(filePath)
  } catch (error) {
    throw createFileSystemError(`Failed to read file: ${filePath}`, 'FS_READ_ERROR', { path: filePath, operation: 'read', cause: error })
  }
}

/**
 * Read file if exists, return null otherwise.
 *
 * @param filePath - Path to file
 * @param encoding - File encoding (default: utf-8)
 * @returns File contents or null if file doesn't exist
 */
export function readFileIfExists(filePath: string, encoding: BufferEncoding = 'utf-8'): string | null {
  if (!existsSync(filePath)) {
    return null
  }
  try {
    return readFileSync(filePath, { encoding })
  } catch {
    return null
  }
}

/**
 * Read and parse JSON file.
 *
 * @param filePath - Path to JSON file
 * @param options - Parse options
 * @param options.default - Default value if file not found (if not provided, throws on missing file)
 * @returns Parsed JSON object
 * @throws {Error} If file doesn't exist (when no default provided) or contains invalid JSON
 *
 * @example
 * ```typescript
 * import { readJsonFile } from '@hyperfrontend/project-scope'
 *
 * // Read with type inference
 * interface Config { port: number }
 * const config = readJsonFile<Config>('./config.json')
 *
 * // Read with default fallback
 * const settings = readJsonFile('./settings.json', { default: {} })
 * ```
 */
export function readJsonFile<T>(filePath: string, options?: { default?: T }): T {
  if (!existsSync(filePath)) {
    if (options && 'default' in options) {
      fsLogger.debug('JSON file not found, using default', { path: filePath })
      return <T>options.default
    }
    fsLogger.debug('JSON file not found', { path: filePath })
    throw createFileSystemError(`File not found: ${filePath}`, 'FS_NOT_FOUND', { path: filePath, operation: 'read' })
  }

  try {
    const content = readFileSync(filePath, { encoding: 'utf-8' })
    return <T>parse(content)
  } catch (error) {
    if ((<{ code?: string }>error)?.code === 'ENOENT') {
      fsLogger.debug('JSON file not found (ENOENT)', { path: filePath })
      throw createFileSystemError(`File not found: ${filePath}`, 'FS_NOT_FOUND', { path: filePath, operation: 'read', cause: error })
    }
    fsLogger.warn('Failed to parse JSON file', { path: filePath })
    throw createFileSystemError(`Failed to parse JSON file: ${filePath}`, 'FS_PARSE_ERROR', {
      path: filePath,
      operation: 'read',
      cause: error,
    })
  }
}

/**
 * Read and parse JSON file if exists, return null otherwise.
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON object or null if file doesn't exist or is invalid
 */
export function readJsonFileIfExists<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null
  }
  try {
    const content = readFileSync(filePath, { encoding: 'utf-8' })
    return <T>parse(content)
  } catch {
    return null
  }
}
