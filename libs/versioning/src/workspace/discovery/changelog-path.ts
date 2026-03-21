import { join } from 'node:path'
import { DEFAULT_CHANGELOG_FILENAME } from '../../flow/models/types'
import { findProjectChangelog } from './discover-changelogs'

/**
 * Checks if a project has a changelog file.
 *
 * @param projectPath - Directory containing the project to check
 * @returns True if changelog exists
 */
export function hasChangelog(projectPath: string): boolean {
  return findProjectChangelog(projectPath) !== null
}

/**
 * Gets the expected changelog path for a project.
 * Returns the standard CHANGELOG.md path regardless of whether it exists.
 *
 * @param projectPath - Directory containing the project files
 * @param fileName - Changelog filename to use (default: 'CHANGELOG.md')
 * @returns Absolute path to changelog file in the project directory
 */
export function getExpectedChangelogPath(projectPath: string, fileName: string = DEFAULT_CHANGELOG_FILENAME): string {
  return join(projectPath, fileName)
}
