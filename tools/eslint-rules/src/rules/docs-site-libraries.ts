import type { Rule } from 'eslint'
import type { ArrayExpression, Identifier, Node, VariableDeclaration, VariableDeclarator } from 'estree'
import type { ProjectJson } from '../utils/nx-project'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseJsonFile } from '../utils/nx-project'

/**
 * Rule identifier for the docs-site-libraries rule.
 */
export const RULE_NAME = 'docs-site-libraries'

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
 * Gets the package name from a library's package.json.
 *
 * @param projectDir - The absolute path to the project directory.
 * @returns The package name or null if not available.
 */
function getPackageName(projectDir: string): string | null {
  const packageJsonPath = join(projectDir, 'package.json')
  const packageJson = parseJsonFile<{ name?: string }>(packageJsonPath)
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
  if (!existsSync(baseDir)) {
    return
  }

  // Check if current directory is a publishable library
  if (isPublishableLibraryDir(baseDir)) {
    const relativePath = baseDir.slice(workspaceRoot.length + 1)
    const packageName = getPackageName(baseDir)

    // Only include libraries with valid package names
    if (packageName) {
      results.push({
        name: basename(baseDir),
        relativePath,
        packageName,
      })
    }
  }

  // Recursively check subdirectories
  let entries: string[]
  try {
    entries = readdirSync(baseDir)
  } catch {
    return
  }

  for (const entry of entries) {
    // Skip common non-project directories using string comparison
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
 * Extracts package names from a LIBRARIES array in a TypeScript file.
 * Navigates the AST to find string literal values at the `packageName` property.
 *
 * @param arrayExpression - The array expression node.
 * @returns Set of package names found.
 */
export function extractPackageNamesFromArray(arrayExpression: ArrayExpression): Set<string> {
  const packageNames = new Set<string>()

  for (const element of arrayExpression.elements) {
    // Each element should be an object expression
    if (!element || element.type !== 'ObjectExpression') {
      continue
    }

    // Look for the packageName property
    for (const property of element.properties) {
      if (property.type !== 'Property') {
        continue
      }

      // Check if the key is 'packageName'
      let keyName: string | null = null
      if (property.key.type === 'Identifier') {
        keyName = property.key.name
      } else if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
        keyName = property.key.value
      }

      if (keyName !== 'packageName') {
        continue
      }

      // Extract the string value
      if (property.value.type === 'Literal' && typeof property.value.value === 'string') {
        packageNames.add(property.value.value)
      }
    }
  }

  return packageNames
}

/**
 * Gets all publishable libraries from the workspace.
 *
 * @param workspaceRoot - The workspace root path.
 * @returns Array of publishable library information, sorted by packageName for deterministic ordering.
 */
export function getAllPublishableLibraries(workspaceRoot: string): PublishableLibrary[] {
  const libraries: PublishableLibrary[] = []

  for (const folder of LIBRARY_FOLDERS) {
    const folderPath = join(workspaceRoot, folder)
    findPublishableLibraries(folderPath, workspaceRoot, libraries)
  }

  // Sort by packageName for deterministic error reporting order
  libraries.sort((a, b) => a.packageName.localeCompare(b.packageName))

  return libraries
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure all publishable libraries are listed in the docs-site LIBRARIES array',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/docs-site-libraries.md',
    },
    schema: [],
    messages: {
      missingLibrary: "Publishable library '{{ packageName }}' ({{ path }}) is not listed in the LIBRARIES array",
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = basename(filePath)

    // Only process content.ts files
    if (fileName !== 'content.ts') {
      return {}
    }

    // Check if this is in docs-site/src/lib/ directory
    const fileDir = dirname(filePath)
    const dirParts = fileDir.split('/')
    const expectedPathSuffix = ['apps', 'docs-site', 'src', 'lib']

    // Verify the file is in the expected location by checking directory suffix
    let isDocsLibDir = false
    if (dirParts.length >= expectedPathSuffix.length) {
      const lastParts = dirParts.slice(-expectedPathSuffix.length)
      isDocsLibDir = lastParts.every((part, index) => part === expectedPathSuffix[index])
    }

    if (!isDocsLibDir) {
      return {}
    }

    const workspaceRoot = findWorkspaceRoot(fileDir)

    if (!workspaceRoot) {
      return {}
    }

    return {
      // Look for: export const LIBRARIES: LibraryInfo[] = [...]
      VariableDeclaration(node: Node) {
        const varDecl = node as VariableDeclaration
        // Check if this is an exported declaration
        const parent = (node as { parent?: Node }).parent
        const isExported = parent?.type === 'ExportNamedDeclaration'
        const isConst = varDecl.kind === 'const'

        if (!isExported || !isConst) {
          return
        }

        // Find the LIBRARIES declaration
        for (const declarator of varDecl.declarations) {
          const decl = declarator as VariableDeclarator
          const id = decl.id as Identifier
          if (id.type !== 'Identifier' || id.name !== 'LIBRARIES') {
            continue
          }

          // Must have an initializer that is an array
          if (!decl.init || decl.init.type !== 'ArrayExpression') {
            continue
          }

          const arrayExpression = decl.init as ArrayExpression

          // Extract package names from the array
          const declaredPackages = extractPackageNamesFromArray(arrayExpression)

          // Get all publishable libraries from the workspace
          const publishableLibraries = getAllPublishableLibraries(workspaceRoot)

          // Check that each publishable library is declared
          for (const lib of publishableLibraries) {
            if (!declaredPackages.has(lib.packageName)) {
              context.report({
                node: decl as unknown as Rule.Node,
                messageId: 'missingLibrary',
                data: {
                  packageName: lib.packageName,
                  path: lib.relativePath,
                },
              })
            }
          }
        }
      },
    }
  },
}

export default rule
