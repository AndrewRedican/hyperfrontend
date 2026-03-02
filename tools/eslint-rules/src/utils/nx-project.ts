import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Represents the structure of a project.json file.
 */
export interface ProjectJson {
  projectType?: string
  targets?: {
    build?: unknown
    publish?: unknown
  }
}

/**
 * Represents the structure of a package.json file.
 */
export interface PackageJson {
  name?: string
  exports?: Record<string, string | Record<string, string>>
  main?: string
}

/**
 * Finds the project root by locating project.json.
 *
 * @param startDir - The directory to start searching from.
 * @returns The project root path, or null if not found.
 */
export function findProjectRoot(startDir: string): string | null {
  let dir = startDir
  while (dir !== '/') {
    if (existsSync(join(dir, 'project.json'))) {
      return dir
    }
    dir = dirname(dir)
  }
  return null
}

/**
 * Parses a JSON file safely.
 *
 * @param filePath - The path to the JSON file.
 * @returns The parsed JSON object, or null if parsing fails.
 */
export function parseJsonFile<T>(filePath: string): T | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return <T>JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Checks if the project at the given root is a publishable library.
 *
 * @param projectRoot - The root directory of the project.
 * @returns True if the project is a publishable library, false otherwise.
 */
export function isPublishableLibrary(projectRoot: string): boolean {
  const projectJsonPath = join(projectRoot, 'project.json')
  const projectJson = parseJsonFile<ProjectJson>(projectJsonPath)

  if (!projectJson) {
    return false
  }

  if (projectJson.projectType !== 'library') {
    return false
  }

  if (!projectJson.targets?.build || !projectJson.targets?.publish) {
    return false
  }

  return true
}
