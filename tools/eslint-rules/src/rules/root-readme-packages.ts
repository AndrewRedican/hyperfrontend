import type { Rule } from 'eslint'
import type { ProjectJson } from '../utils/nx-project'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseJsonFile } from '../utils/nx-project'

/**
 * Rule identifier for the root-readme-packages rule.
 */
export const RULE_NAME = 'root-readme-packages'

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
  packageName?: string
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

  // Must be a library with build and publish targets
  if (projectJson.projectType !== 'library') {
    return false
  }

  if (!projectJson.targets?.build || !projectJson.targets?.publish) {
    return false
  }

  return true
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
    const packageJsonPath = join(baseDir, 'package.json')

    const projectJson = parseJsonFile<ProjectJson & { name?: string }>(projectJsonPath)
    const packageJson = parseJsonFile<{ name?: string }>(packageJsonPath)

    results.push({
      name: projectJson?.name ?? basename(baseDir),
      relativePath,
      packageName: packageJson?.name,
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
 * Extracts package paths mentioned in a README section content.
 * Looks for markdown table rows with links to GitHub paths.
 *
 * @param sectionContent - The content of a README section.
 * @returns Array of relative paths found in the section.
 */
export function extractMentionedPaths(sectionContent: string): string[] {
  const paths: string[] = []
  const lines = sectionContent.split('\n')

  for (const line of lines) {
    // Skip table header and separator rows
    if (line.startsWith('|--') || line.startsWith('| --') || line.includes('Package') || line.includes('Description')) {
      continue
    }

    // Look for GitHub links in table rows
    // Pattern: [name](https://github.com/.../blob/main/libs/something)
    const githubBlobMain = '/blob/main/'
    const githubIndex = line.indexOf(githubBlobMain)

    if (githubIndex !== -1) {
      // Extract the path after /blob/main/
      const afterBlobMain = line.slice(githubIndex + githubBlobMain.length)
      // Find the end of the path (closing parenthesis)
      const endIndex = afterBlobMain.indexOf(')')

      if (endIndex !== -1) {
        const path = afterBlobMain.slice(0, endIndex)
        // Only include paths that start with known library folders
        if (path.startsWith('libs/') || path.startsWith('plugins/')) {
          paths.push(path)
        }
      }
    }
  }

  return paths
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
 * Parses markdown content to find sections.
 *
 * @param content - The markdown content.
 * @returns Map of section titles to their content and line numbers.
 */
export function parseReadmeSections(content: string): Map<string, { content: string; startLine: number; endLine: number }> {
  const sections = new Map<string, { content: string; startLine: number; endLine: number }>()
  const lines = content.split('\n')
  let currentSection: { title: string; startLine: number; lines: string[] } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for level 2 heading: starts with "## " but not "### "
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      // Save previous section if exists
      if (currentSection) {
        sections.set(currentSection.title, {
          content: currentSection.lines.join('\n'),
          startLine: currentSection.startLine,
          endLine: i,
        })
      }

      // Start new section
      const title = line.slice(3).trim()
      currentSection = { title, startLine: i + 1, lines: [] }
    } else if (currentSection) {
      currentSection.lines.push(line)
    }
  }

  // Save last section
  if (currentSection) {
    sections.set(currentSection.title, {
      content: currentSection.lines.join('\n'),
      startLine: currentSection.startLine,
      endLine: lines.length,
    })
  }

  return sections
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure root README.md lists all publishable library projects in Main Packages or Internal Packages sections',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/root-readme-packages.md',
    },
    schema: [],
    messages: {
      missingPackage:
        "Publishable library '{{ name }}' ({{ path }}) is not listed in either 'Main Packages' or 'Internal Packages' section",
      missingMainPackagesSection: "Root README.md must have a '## Main Packages' section",
      missingInternalPackagesSection: "Root README.md must have a '## Internal Packages' section",
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = basename(filePath)

    // Only process README.md files
    if (fileName !== 'README.md') {
      return {}
    }

    const fileDir = dirname(filePath)
    const workspaceRoot = findWorkspaceRoot(fileDir)

    // Only process root README.md (in workspace root)
    if (!workspaceRoot || fileDir !== workspaceRoot) {
      return {}
    }

    return {
      root(node: Rule.Node) {
        const sourceCode = context.sourceCode
        const content = sourceCode.getText()

        // Parse sections from README
        const sections = parseReadmeSections(content)

        // Check that required sections exist
        const mainPackagesSection = sections.get('Main Packages')
        const internalPackagesSection = sections.get('Internal Packages')

        if (!mainPackagesSection) {
          context.report({
            node,
            messageId: 'missingMainPackagesSection',
          })
        }

        if (!internalPackagesSection) {
          context.report({
            node,
            messageId: 'missingInternalPackagesSection',
          })
        }

        // If either section is missing, we can't check for missing packages
        if (!mainPackagesSection || !internalPackagesSection) {
          return
        }

        // Extract all mentioned paths from both sections
        const mainPaths = extractMentionedPaths(mainPackagesSection.content)
        const internalPaths = extractMentionedPaths(internalPackagesSection.content)
        const allMentionedPaths = new Set([...mainPaths, ...internalPaths])

        // Find all publishable libraries in the workspace
        const publishableLibraries: PublishableLibrary[] = []

        for (const folder of LIBRARY_FOLDERS) {
          const folderPath = join(workspaceRoot, folder)
          findPublishableLibraries(folderPath, workspaceRoot, publishableLibraries)
        }

        // Check that each publishable library is mentioned
        for (const lib of publishableLibraries) {
          if (!allMentionedPaths.has(lib.relativePath)) {
            context.report({
              node,
              messageId: 'missingPackage',
              data: {
                name: lib.packageName ?? lib.name,
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
