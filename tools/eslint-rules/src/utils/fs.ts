import {
  exists as projectScopeExists,
  isDirectory as projectScopeIsDirectory,
  readDirectory as projectScopeReadDirectory,
  readFileContent as projectScopeReadFileContent,
  readFileIfExists as projectScopeReadFileIfExists,
  readJsonFile as projectScopeReadJsonFile,
  readJsonFileIfExists as projectScopeReadJsonFileIfExists,
} from '@hyperfrontend/project-scope/core/fs'
import { createRuleLogger } from './logger'

const logger = createRuleLogger('fs')

/**
 * Read file contents as string.
 * Throws on error.
 *
 * @param filePath - Path to file
 * @returns File contents
 * @throws {Error} If file doesn't exist or can't be read
 */
export const readFileContent = projectScopeReadFileContent

/**
 * Read file if exists, return null otherwise.
 *
 * @param filePath - Path to file
 * @returns File contents or null
 */
export const readFileIfExists = projectScopeReadFileIfExists

/**
 * Check if path exists.
 *
 * @param path - Path to check
 * @returns True if exists
 */
export const exists = projectScopeExists

/**
 * Check if path is a directory.
 *
 * @param path - Path to check
 * @returns True if path is a directory
 */
export const isDirectory = projectScopeIsDirectory

/**
 * Read directory contents.
 * Returns an array of entry names (strings) for simpler usage.
 *
 * @param dirPath - Path to directory
 * @returns Array of entry names
 */
export function readDirectory(dirPath: string): string[] {
  try {
    const entries = projectScopeReadDirectory(dirPath)
    return entries.map((entry) => entry.name)
  } catch {
    return []
  }
}

/**
 * Read and parse JSON file.
 * Throws on error unless default is provided.
 *
 * @param filePath - Path to JSON file
 * @param options - Options with optional default value
 * @returns Parsed JSON
 */
export const readJsonFile = projectScopeReadJsonFile

/**
 * Read and parse JSON file if it exists.
 * Returns null if file doesn't exist or parsing fails.
 *
 * This is the safe equivalent of the legacy parseJsonFile function.
 * Use this when you need to handle missing files gracefully.
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON or null
 *
 * @example
 * ```typescript
 * const projectJson = readJsonFileIfExists<ProjectJson>('./project.json')
 * if (projectJson) {
 *   // process project.json
 * }
 * ```
 */
export function readJsonFileIfExists<T>(filePath: string): T | null {
  logger.debug('Reading JSON file', { path: filePath })

  try {
    return projectScopeReadJsonFileIfExists<T>(filePath)
  } catch (error) {
    logger.debug('Failed to read/parse JSON file', { path: filePath, error })
    return null
  }
}
