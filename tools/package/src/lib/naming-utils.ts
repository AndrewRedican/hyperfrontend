/**
 * This repository's naming conventions: a project under `libs` is `lib-<name>`, with a nested
 * directory's segments appended, one under `tools` is `tool-<name>`, and a package is the
 * project's name without its prefix under the `@hyperfrontend` scope.
 *
 * @module lib/naming-utils
 */

import { posix } from 'node:path'
import { names } from '@hyperfrontend/workspace/generators'

/** The scope of this repository's packages. */
export const PACKAGE_SCOPE = '@hyperfrontend'

/**
 * Derive project name from project root path following hyperfrontend naming conventions.
 *
 * @param projectRoot - The project root path (e.g., 'libs/utils/data')
 * @returns The derived project name (e.g., 'lib-data-utils')
 */
export function deriveProjectNameFromPath(projectRoot: string): string {
  const parts = projectRoot.split(posix.sep).filter(Boolean)
  if (parts[0] === 'libs') {
    if (parts.length === 2) return `lib-${parts[1]}`
    if (parts.length >= 3) return `lib-${parts[parts.length - 1]}-${parts.slice(1, -1).join('-')}`
  } else if (parts[0] === 'tools') {
    return `tool-${parts.slice(1).join('-')}`
  } else if (parts[0] === 'apps') {
    return parts.slice(1).join('-')
  }
  return parts[parts.length - 1] ?? ''
}

/**
 * Derive npm package name from project name.
 *
 * @param projectName - The project name (e.g., 'lib-data-utils', 'tool-pipeline')
 * @returns The npm package name (e.g., '@hyperfrontend/data-utils')
 */
export function derivePackageName(projectName: string): string {
  return `${PACKAGE_SCOPE}/${projectName.replace(/^(lib|tool)-/, '')}`
}

/**
 * Derive project name from a simple name and project type prefix.
 *
 * @param name - Simple name (e.g., 'data-utils')
 * @param prefix - Project type prefix (e.g., 'lib', 'tool')
 * @returns Project name (e.g., 'lib-data-utils')
 */
export function deriveProjectName(name: string, prefix: string): string {
  const cleanName = names(name).fileName
  return prefix ? `${prefix}-${cleanName}` : cleanName
}

/**
 * Extract the prefix from a project name.
 *
 * @param projectName - Project name (e.g., 'lib-my-utils')
 * @returns The prefix (e.g., 'lib') or empty string if no prefix
 */
export function extractProjectPrefix(projectName: string): string {
  const match = projectName.match(/^(lib|tool)-/)
  return match?.[1] ?? ''
}
