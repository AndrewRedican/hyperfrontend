/**
 * Changelog Path Utilities
 *
 * Functions for checking changelog existence and resolving expected paths.
 */

import { join } from 'node:path'
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
 * @returns Absolute path to CHANGELOG.md in the project directory
 */
export function getExpectedChangelogPath(projectPath: string): string {
  return join(projectPath, 'CHANGELOG.md')
}
