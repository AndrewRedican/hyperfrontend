import { names } from '@nx/devkit'

/**
 * Extract the directory name from a full path.
 *
 * @param path - The full path to extract from
 * @returns The last segment of the path
 */
export function getDirectoryName(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
}

/**
 * Derive project name from project root path following hyperfrontend naming conventions.
 *
 * @param projectRoot - The project root path (e.g., 'libs/utils/data')
 * @returns The derived project name (e.g., 'lib-data-utils')
 */
export function deriveProjectNameFromPath(projectRoot: string): string {
  const parts = projectRoot.split('/').filter(Boolean)

  if (parts[0] === 'libs') {
    if (parts.length === 2) {
      return `lib-${parts[1]}`
    } else if (parts.length >= 3) {
      const parentPath = parts.slice(1, -1).join('-')
      const libName = parts[parts.length - 1]
      return `lib-${libName}-${parentPath}`
    }
  } else if (parts[0] === 'tools') {
    return `tool-${parts.slice(1).join('-')}`
  } else if (parts[0] === 'plugins') {
    return `plugin-${parts.slice(1).join('-')}`
  } else if (parts[0] === 'apps') {
    return parts.slice(1).join('-')
  }

  return parts[parts.length - 1] ?? ''
}

/**
 * Derive npm package name from project name.
 *
 * @param projectName - The project name (e.g., 'lib-data-utils', 'tool-workspace', 'plugin-features')
 * @returns The npm package name (e.g., '@hyperfrontend/data-utils')
 */
export function derivePackageName(projectName: string): string {
  const baseName = projectName.replace(/^(lib|tool|plugin)-/, '')
  return `@hyperfrontend/${baseName}`
}

/**
 * Derive project name from a simple name and project type prefix.
 *
 * @param name - Simple name (e.g., 'data-utils')
 * @param prefix - Project type prefix (e.g., 'lib', 'tool', 'plugin')
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
  const match = projectName.match(/^(lib|tool|plugin)-/)
  return match?.[1] ?? ''
}
