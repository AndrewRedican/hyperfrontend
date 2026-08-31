import type { Rule } from 'eslint'
import { basename, dirname, join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import {
  exists,
  findNxWorkspaceRoot,
  isDirectory,
  isPublishableLibraryDir,
  readDirectory,
  readFileIfExists,
  readJsonFileIfExists,
} from '../utils'

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
 * Map of Nx target names this rule cares about within a project.json file.
 */
interface ProjectTargets {
  /** Build target configuration */
  build?: unknown
  /** Publish target configuration */
  publish?: unknown
}

/**
 * Interface for project.json structure.
 */
interface ProjectJson {
  /** Project name identifier */
  name?: string
  /** Type of project (library, application, etc.) */
  projectType?: string
  /** Build targets configuration */
  targets?: ProjectTargets
}

/**
 * Adds the optional `name` field that may appear on `project.json` even when
 * the upstream interface omits it.
 */
type WithProjectName = {
  /** Project name from project.json */
  name?: string
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

  if (parts.length >= 3 && parts[0] === 'libs' && parts[1] === 'utils') {
    const utilName = parts[2] as string
    return `${utilName}-utils`
  }

  if (parts.length >= 2) {
    return parts[parts.length - 1] as string
  }

  return parts[parts.length - 1] as string
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
    const projectJson = readJsonFileIfExists<ProjectJson & WithProjectName>(projectJsonPath)

    results.push({
      name: projectJson?.name ?? `lib-${basename(baseDir)}`,
      relativePath,
      coverageFlag: deriveCoverageFlag(relativePath),
    })
  }

  /** Directory entries read from the file system */
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
    const line = (lines[i] as string).trim()

    if (line === filterPattern || line.startsWith(`${filterPattern} `)) {
      for (let j = i; j < min(i + 5, lines.length); j++) {
        if ((lines[j] as string).includes(pathPattern)) {
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

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('#')) {
      continue
    }

    if (!trimmed.startsWith('add_if_changed')) {
      continue
    }

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
  return exists(workflowPath)
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
  return readFileIfExists(filePath)
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

    if (fileName !== 'ci-libraries.yml') {
      return {}
    }

    const fileDir = dirname(filePath)
    const workspaceRoot = findNxWorkspaceRoot(fileDir)

    if (!workspaceRoot) {
      return {}
    }

    const expectedDir = join(workspaceRoot, '.github', 'workflows')
    if (fileDir !== expectedDir) {
      return {}
    }

    return {
      Program(node: Rule.Node) {
        const sourceCode = context.sourceCode
        const ciLibrariesContent = sourceCode.getText()

        const ciMainPath = join(workspaceRoot, '.github', 'workflows', 'ci-main.yml')
        const ciMainContent = safeReadFile(ciMainPath)

        if (!ciMainContent) {
          context.report({
            node,
            messageId: 'missingCiMainFile',
          })
          return
        }

        const publishableLibraries: PublishableLibrary[] = []

        for (const folder of LIBRARY_FOLDERS) {
          const folderPath = join(workspaceRoot, folder)
          findPublishableLibraries(folderPath, workspaceRoot, publishableLibraries)
        }

        for (const lib of publishableLibraries) {
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
