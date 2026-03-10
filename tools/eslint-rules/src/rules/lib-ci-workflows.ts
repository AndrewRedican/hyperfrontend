import type { Rule } from 'eslint'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseJsonFile } from '../utils/nx-project'

/**
 * Rule identifier for the lib-ci-workflows rule.
 */
export const RULE_NAME = 'lib-ci-workflows'

/**
 * Folders to scan for publishable libraries.
 */
const LIBRARY_FOLDERS = ['libs', 'plugins'] as const

/**
 * Represents a publishable library project for CI/CD validation.
 */
export interface PublishableLibrary {
  /** Project name from project.json (e.g., lib-network-protocol) */
  name: string
  /** Relative path from workspace root (e.g., libs/network-protocol) */
  relativePath: string
  /** Coverage flag name derived from path (e.g., network-protocol) */
  coverageFlag: string
}

/**
 * Interface for project.json structure.
 */
interface ProjectJson {
  name?: string
  projectType?: string
  targets?: {
    build?: unknown
    publish?: unknown
  }
}

/**
 * Checks if a directory contains a publishable library project.
 *
 * @param projectDir - The absolute path to the project directory.
 * @returns True if the project is a publishable library, false otherwise.
 */
function isPublishableLibraryDir(projectDir: string): boolean {
  const projectJsonPath = join(projectDir, 'project.json')

  if (!existsSync(projectJsonPath)) {
    return false
  }

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

/**
 * Derives the coverage flag from a library path.
 * Example: "libs/utils/json" -> "json-utils"
 * Example: "libs/network-protocol" -> "network-protocol"
 *
 * @param relativePath - The relative path to the library.
 * @returns The coverage flag name.
 */
export function deriveCoverageFlag(relativePath: string): string {
  const parts = relativePath.split('/')

  // Handle libs/utils/* pattern
  if (parts.length >= 3 && parts[0] === 'libs' && parts[1] === 'utils') {
    const utilName = parts[2]
    return `${utilName}-utils`
  }

  // Handle libs/* or plugins/* pattern
  if (parts.length >= 2) {
    return parts[parts.length - 1]
  }

  return parts[parts.length - 1]
}

/**
 * Recursively finds all publishable libraries in a directory.
 *
 * @param baseDir - The absolute path to search.
 * @param workspaceRoot - The workspace root path.
 * @param results - Array to accumulate results.
 */
function findPublishableLibraries(baseDir: string, workspaceRoot: string, results: PublishableLibrary[]): void {
  if (!existsSync(baseDir)) {
    return
  }

  // Check if current directory is a publishable library
  if (isPublishableLibraryDir(baseDir)) {
    const relativePath = baseDir.slice(workspaceRoot.length + 1)
    const projectJsonPath = join(baseDir, 'project.json')
    const projectJson = parseJsonFile<ProjectJson & { name?: string }>(projectJsonPath)

    results.push({
      name: projectJson?.name ?? `lib-${basename(baseDir)}`,
      relativePath,
      coverageFlag: deriveCoverageFlag(relativePath),
    })
  }

  // Recursively check subdirectories
  let entries: string[]
  try {
    entries = readdirSync(baseDir)
  } catch {
    return
  }

  for (const entry of entries) {
    // Skip common non-project directories
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry.startsWith('.')) {
      continue
    }

    const entryPath = join(baseDir, entry)

    let stats
    try {
      stats = statSync(entryPath)
    } catch {
      continue
    }

    if (stats.isDirectory()) {
      findPublishableLibraries(entryPath, workspaceRoot, results)
    }
  }
}

/**
 * Finds the workspace root by looking for nx.json.
 *
 * @param startDir - The directory to start searching from.
 * @returns The workspace root path, or null if not found.
 */
export function findWorkspaceRoot(startDir: string): string | null {
  let dir = startDir
  const root = '/'

  while (dir !== root) {
    if (existsSync(join(dir, 'nx.json'))) {
      return dir
    }
    dir = dirname(dir)
  }

  return null
}

/**
 * Checks if a path filter exists for a library in ci-libraries.yml content.
 *
 * @param content - The content of ci-libraries.yml.
 * @param coverageFlag - The coverage flag (e.g., "network-protocol").
 * @param relativePath - The library path (e.g., "libs/network-protocol").
 * @returns True if the path filter exists.
 */
export function hasPathFilter(content: string, coverageFlag: string, relativePath: string): boolean {
  const lines = content.split('\n')
  const filterPattern = `${coverageFlag}:`
  const pathPattern = `'${relativePath}/**'`

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Look for the filter name followed by colon
    if (line === filterPattern || line.startsWith(`${filterPattern} `)) {
      // Check if the next line (or same line) contains the path pattern
      for (let j = i; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes(pathPattern)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Checks if a matrix entry (add_if_changed call) exists for a library.
 *
 * @param content - The content of ci-libraries.yml.
 * @param projectName - The project name (e.g., "lib-network-protocol").
 * @param coverageFlag - The coverage flag (e.g., "network-protocol").
 * @param relativePath - The library path (e.g., "libs/network-protocol").
 * @returns True if the matrix entry exists.
 */
export function hasMatrixEntry(content: string, projectName: string, coverageFlag: string, relativePath: string): boolean {
  const lines = content.split('\n')

  // Look for add_if_changed line with all required parameters
  for (const line of lines) {
    const trimmed = line.trim()

    // Skip commented lines
    if (trimmed.startsWith('#')) {
      continue
    }

    if (!trimmed.startsWith('add_if_changed')) {
      continue
    }

    // Check if the line contains all required components
    const hasFilterOutput = trimmed.includes(`filter.outputs.${coverageFlag}`)
    const hasProjectName = trimmed.includes(`"${projectName}"`)
    const hasPath = trimmed.includes(`"${relativePath}"`)
    const hasFlag = trimmed.includes(`"${coverageFlag}"`)

    if (hasFilterOutput && hasProjectName && hasPath && hasFlag) {
      return true
    }
  }

  return false
}

/**
 * Checks if a library status workflow file exists.
 *
 * @param workspaceRoot - The workspace root path.
 * @param projectName - The project name (e.g., "lib-network-protocol").
 * @returns True if the workflow file exists.
 */
export function hasStatusWorkflow(workspaceRoot: string, projectName: string): boolean {
  const workflowPath = join(workspaceRoot, '.github', 'workflows', `ci-${projectName}.yml`)
  return existsSync(workflowPath)
}

/**
 * Checks if a library has a coverage entry in ci-main.yml.
 *
 * @param content - The content of ci-main.yml.
 * @param coverageFlag - The coverage flag (e.g., "network-protocol").
 * @param relativePath - The library path (e.g., "libs/network-protocol").
 * @returns True if the coverage entry exists.
 */
export function hasCoverageEntry(content: string, coverageFlag: string, relativePath: string): boolean {
  // Look for the LIBS array entry format: "flag:path"
  const entry = `"${coverageFlag}:${relativePath}"`
  return content.includes(entry)
}

/**
 * Reads a file from the workspace safely.
 * Returns null if the file doesn't exist or can't be read.
 *
 * @param filePath - The absolute path to the file.
 * @returns The file content or null.
 */
function safeReadFile(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) {
      return null
    }
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure publishable libraries have complete CI/CD workflow configuration',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-ci-workflows.md',
    },
    schema: [],
    messages: {
      missingPathFilter:
        "Publishable library '{{ name }}' ({{ path }}) is missing path filter in ci-libraries.yml. Add: {{ flag }}: - '{{ path }}/**'",
      missingMatrixEntry:
        'Publishable library \'{{ name }}\' ({{ path }}) is missing matrix entry in ci-libraries.yml. Add: add_if_changed "${{ steps.filter.outputs.{{ flag }} }}" "{{ name }}" "{{ path }}" "{{ flag }}"',
      missingStatusWorkflow:
        "Publishable library '{{ name }}' ({{ path }}) is missing status workflow. Create: .github/workflows/ci-{{ name }}.yml",
      missingCoverageEntry:
        'Publishable library \'{{ name }}\' ({{ path }}) is missing coverage entry in ci-main.yml. Add: "{{ flag }}:{{ path }}"',
      missingCiLibrariesFile: 'Cannot find .github/workflows/ci-libraries.yml in workspace',
      missingCiMainFile: 'Cannot find .github/workflows/ci-main.yml in workspace',
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = basename(filePath)

    // Only process ci-libraries.yml
    if (fileName !== 'ci-libraries.yml') {
      return {}
    }

    const fileDir = dirname(filePath)
    const workspaceRoot = findWorkspaceRoot(fileDir)

    if (!workspaceRoot) {
      return {}
    }

    // Verify we're in the .github/workflows directory
    const expectedDir = join(workspaceRoot, '.github', 'workflows')
    if (fileDir !== expectedDir) {
      return {}
    }

    return {
      Program(node: Rule.Node) {
        const sourceCode = context.sourceCode
        const ciLibrariesContent = sourceCode.getText()

        // Read ci-main.yml
        const ciMainPath = join(workspaceRoot, '.github', 'workflows', 'ci-main.yml')
        const ciMainContent = safeReadFile(ciMainPath)

        if (!ciMainContent) {
          context.report({
            node,
            messageId: 'missingCiMainFile',
          })
          return
        }

        // Find all publishable libraries
        const publishableLibraries: PublishableLibrary[] = []

        for (const folder of LIBRARY_FOLDERS) {
          const folderPath = join(workspaceRoot, folder)
          findPublishableLibraries(folderPath, workspaceRoot, publishableLibraries)
        }

        // Check each publishable library for CI/CD configuration
        for (const lib of publishableLibraries) {
          // Check path filter in ci-libraries.yml
          if (!hasPathFilter(ciLibrariesContent, lib.coverageFlag, lib.relativePath)) {
            context.report({
              node,
              messageId: 'missingPathFilter',
              data: {
                name: lib.name,
                path: lib.relativePath,
                flag: lib.coverageFlag,
              },
            })
          }

          // Check matrix entry in ci-libraries.yml
          if (!hasMatrixEntry(ciLibrariesContent, lib.name, lib.coverageFlag, lib.relativePath)) {
            context.report({
              node,
              messageId: 'missingMatrixEntry',
              data: {
                name: lib.name,
                path: lib.relativePath,
                flag: lib.coverageFlag,
              },
            })
          }

          // Check status workflow exists
          if (!hasStatusWorkflow(workspaceRoot, lib.name)) {
            context.report({
              node,
              messageId: 'missingStatusWorkflow',
              data: {
                name: lib.name,
                path: lib.relativePath,
              },
            })
          }

          // Check coverage entry in ci-main.yml
          if (!hasCoverageEntry(ciMainContent, lib.coverageFlag, lib.relativePath)) {
            context.report({
              node,
              messageId: 'missingCoverageEntry',
              data: {
                name: lib.name,
                path: lib.relativePath,
                flag: lib.coverageFlag,
              },
            })
          }
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
