import type { Rule } from 'eslint'
import type { ProjectJson } from '../utils/nx-project'
import { basename, dirname, join } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, findNxWorkspaceRoot, isDirectory, isPublishableLibraryDir, readDirectory, readJsonFileIfExists } from '../utils'

/**
 * Rule identifier for the lib-compatibility-docs rule.
 */
export const RULE_NAME = 'lib-compatibility-docs'

/**
 * Folders to scan for publishable libraries.
 */
const LIBRARY_FOLDERS = ['libs', 'plugins'] as const

/**
 * Represents a publishable library project.
 */
export interface PublishableLibrary {
  /** Project name from project.json */
  name: string
  /** Relative path from workspace root (e.g., "libs/logging") */
  relativePath: string
  /** Package name from package.json if available */
  packageName: string
  /** Whether the library has browser bundles (IIFE/UMD) configured */
  hasBrowserBundles: boolean
}

/**
 * Extended project.json structure with build options.
 */
interface ProjectJsonWithBuildOptions extends ProjectJson {
  targets?: {
    build?: {
      options?: {
        iife?: { entry?: string; globalName?: string }
        umd?: { entry?: string; globalName?: string }
        [key: string]: unknown
      }
      [key: string]: unknown
    }
    [key: string]: unknown
  }
}

/**
 * Checks if a library has browser bundles (IIFE or UMD) configured.
 *
 * @param projectDir - The absolute path to the project directory.
 * @returns True if the library has IIFE or UMD build configuration.
 */
function hasBrowserBundles(projectDir: string): boolean {
  const projectJsonPath = join(projectDir, 'project.json')
  const projectJson = readJsonFileIfExists<ProjectJsonWithBuildOptions>(projectJsonPath)

  if (!projectJson?.targets?.build?.options) {
    return false
  }

  const options = projectJson.targets.build.options
  return options.iife !== undefined || options.umd !== undefined
}

/**
 * Gets the package name from a library's package.json.
 *
 * @param projectDir - The absolute path to the project directory.
 * @returns The package name or null if not available.
 */
function getPackageName(projectDir: string): string | null {
  const packageJsonPath = join(projectDir, 'package.json')
  const packageJson = readJsonFileIfExists<{ name?: string }>(packageJsonPath)
  return packageJson?.name ?? null
}

/**
 * Recursively finds all publishable libraries in a directory.
 *
 * @param baseDir - The absolute path to search.
 * @param workspaceRoot - The workspace root path.
 * @param results - Array to accumulate results.
 */
function findPublishableLibraries(baseDir: string, workspaceRoot: string, results: PublishableLibrary[]): void {
  if (!exists(baseDir)) {
    return
  }

  if (isPublishableLibraryDir(baseDir)) {
    const relativePath = baseDir.slice(workspaceRoot.length + 1)
    const projectJsonPath = join(baseDir, 'project.json')
    const packageName = getPackageName(baseDir)
    const projectJson = readJsonFileIfExists<ProjectJson & { name?: string }>(projectJsonPath)

    if (packageName) {
      results.push({
        name: projectJson?.name ?? basename(baseDir),
        relativePath,
        packageName,
        hasBrowserBundles: hasBrowserBundles(baseDir),
      })
    }
  }

  let entries: string[]
  try {
    entries = readDirectory(baseDir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry.startsWith('.')) {
      continue
    }

    const entryPath = join(baseDir, entry)

    if (isDirectory(entryPath)) {
      findPublishableLibraries(entryPath, workspaceRoot, results)
    }
  }
}

/**
 * Gets all publishable libraries from the workspace.
 *
 * @param workspaceRoot - The workspace root path.
 * @returns Array of publishable library information, sorted by packageName for deterministic ordering.
 */
function getAllPublishableLibraries(workspaceRoot: string): PublishableLibrary[] {
  const libraries: PublishableLibrary[] = []

  for (const folder of LIBRARY_FOLDERS) {
    const folderPath = join(workspaceRoot, folder)
    findPublishableLibraries(folderPath, workspaceRoot, libraries)
  }

  libraries.sort((a, b) => a.packageName.localeCompare(b.packageName))

  return libraries
}

/**
 * Extracts package names mentioned in LIBRARY_COMPATIBILITY.md.
 * Looks for patterns like `@hyperfrontend/package-name` in backticks.
 *
 * @param content - The content of LIBRARY_COMPATIBILITY.md.
 * @returns Set of package names found.
 */
export function extractMentionedPackages(content: string): Set<string> {
  const packages = createSet<string>()

  const backtickPattern = /`(@hyperfrontend\/[a-z][a-z0-9-]*)`/g
  let match: RegExpExecArray | null

  match = backtickPattern.exec(content)
  while (match !== null) {
    packages.add(match[1])
    match = backtickPattern.exec(content)
  }

  return packages
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure LIBRARY_COMPATIBILITY.md lists all publishable library projects',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-compatibility-docs.md',
    },
    schema: [],
    messages: {
      missingLibrary: "Library '{{ packageName }}' ({{ path }}) has browser bundles but is not documented in LIBRARY_COMPATIBILITY.md",
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = basename(filePath)

    if (fileName !== 'LIBRARY_COMPATIBILITY.md') {
      return {}
    }

    const fileDir = dirname(filePath)
    const workspaceRoot = findNxWorkspaceRoot(fileDir)

    if (!workspaceRoot || fileDir !== workspaceRoot) {
      return {}
    }

    return {
      root(node: Rule.Node) {
        const sourceCode = context.sourceCode
        const content = sourceCode.getText()

        const mentionedPackages = extractMentionedPackages(content)

        const publishableLibraries = getAllPublishableLibraries(workspaceRoot)

        const browserLibraries = publishableLibraries.filter((lib) => lib.hasBrowserBundles)

        for (const lib of browserLibraries) {
          if (!mentionedPackages.has(lib.packageName)) {
            context.report({
              node,
              messageId: 'missingLibrary',
              data: {
                packageName: lib.packageName,
                path: lib.relativePath,
              },
            })
          }
        }
      },
    }
  },
}

export default rule
