import type { Rule } from 'eslint'
import type { ArrayExpression, Identifier, Node, VariableDeclaration, VariableDeclarator } from 'estree'
import { basename, dirname, join } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
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
 * Rule identifier for the docs-site-libraries rule.
 */
export const RULE_NAME = 'docs-site-libraries'

/**
 * Folders to scan for publishable libraries.
 */
const LIBRARY_FOLDERS = ['libs', 'plugins'] as const

/**
 * Editorial hierarchy behind the docs-site library index, relative to the
 * workspace root. Every library the index lists is also placed on one of its
 * levels, which is what puts the library on the page at all.
 */
const ECOSYSTEM_FILE = 'apps/docs-site/src/lib/ecosystem.ts'

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
 * Slice of `package.json` we read when extracting the published package name.
 */
type PackageJsonName = {
  /** Package name field */
  name?: string
}

/**
 * Minimal AST helper exposing the optional `parent` reference attached to nodes
 * by ESLint at traversal time.
 */
type NodeWithParent = {
  /** Parent AST node */
  parent?: Node
}

/**
 * Gets the package name from a library's package.json.
 *
 * @param projectDir - The absolute path to the project directory.
 * @returns The package name or null if not available.
 */
function getPackageName(projectDir: string): string | null {
  const packageJsonPath = join(projectDir, 'package.json')
  const packageJson = readJsonFileIfExists<PackageJsonName>(packageJsonPath)
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
    const packageName = getPackageName(baseDir)

    if (packageName) {
      results.push({
        name: basename(baseDir),
        relativePath,
        packageName,
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
 * Extracts package names from a LIBRARIES array in a TypeScript file.
 * Navigates the AST to find string literal values at the `packageName` property.
 *
 * @param arrayExpression - The array expression node.
 * @returns Set of package names found.
 */
export function extractPackageNamesFromArray(arrayExpression: ArrayExpression): Set<string> {
  const packageNames = createSet<string>()

  for (const element of arrayExpression.elements) {
    if (!element || element.type !== 'ObjectExpression') {
      continue
    }

    for (const property of element.properties) {
      if (property.type !== 'Property') {
        continue
      }

      let keyName: string | null = null
      if (property.key.type === 'Identifier') {
        keyName = property.key.name
      } else if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
        keyName = property.key.value
      }

      if (keyName !== 'packageName') {
        continue
      }

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

  libraries.sort((a, b) => a.packageName.localeCompare(b.packageName))

  return libraries
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure all publishable libraries are listed in the docs-site LIBRARIES array and placed in the ecosystem hierarchy',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/docs-site-libraries.md',
    },
    schema: [],
    messages: {
      missingLibrary: "Publishable library '{{ packageName }}' ({{ path }}) is not listed in the LIBRARIES array",
      missingFromEcosystem:
        "Publishable library '{{ packageName }}' ({{ path }}) is not placed on any level of ECOSYSTEM_TIERS in {{ file }}, so it would not appear on /docs/libraries",
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = basename(filePath)
    const fileDir = dirname(filePath)
    const dirParts = fileDir.split('/')

    const isContentTs = fileName === 'content.ts' && checkPathSuffix(dirParts, ['apps', 'docs-site', 'src', 'lib'])

    const isGenerateDocsTs = fileName === 'generate-docs.ts' && checkPathSuffix(dirParts, ['apps', 'docs-site', 'scripts'])

    const isNavigationTs = fileName === 'navigation.ts' && checkPathSuffix(dirParts, ['apps', 'docs-site', 'src', 'lib'])

    if (!isContentTs && !isGenerateDocsTs && !isNavigationTs) {
      return {}
    }

    const workspaceRoot = findNxWorkspaceRoot(fileDir)

    if (!workspaceRoot) {
      return {}
    }

    return {
      VariableDeclaration(node: Node) {
        const varDecl = node as VariableDeclaration
        const isConst = varDecl.kind === 'const'

        if (!isConst) {
          return
        }

        const parent = (node as NodeWithParent).parent
        const isExported = parent?.type === 'ExportNamedDeclaration'

        if (isContentTs && !isExported) {
          return
        }

        for (const declarator of varDecl.declarations) {
          const decl = declarator as VariableDeclarator
          const id = decl.id as Identifier
          if (id.type !== 'Identifier' || id.name !== 'LIBRARIES') {
            continue
          }

          if (!decl.init || decl.init.type !== 'ArrayExpression') {
            continue
          }

          const arrayExpression = decl.init as ArrayExpression

          const declaredPackages = extractPackageNamesFromArray(arrayExpression)

          const publishableLibraries = getAllPublishableLibraries(workspaceRoot)

          // context: only content.ts drives the index page, so only it answers for a library missing from the hierarchy.
          const ecosystemContent = isContentTs ? readFileIfExists(join(workspaceRoot, ECOSYSTEM_FILE)) : null

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

            if (ecosystemContent !== null && !ecosystemContent.includes(`'${lib.packageName}'`)) {
              context.report({
                node: decl as unknown as Rule.Node,
                messageId: 'missingFromEcosystem',
                data: {
                  packageName: lib.packageName,
                  path: lib.relativePath,
                  file: ECOSYSTEM_FILE,
                },
              })
            }
          }
        }
      },
    }
  },
}

/**
 * Checks if the directory path ends with the expected suffix.
 *
 * @param dirParts - The directory path split by '/'
 * @param expectedSuffix - Array of path segments to match at the end (e.g., ['apps', 'docs-site', 'src', 'lib'])
 * @returns True if the path ends with the expected suffix
 */
function checkPathSuffix(dirParts: string[], expectedSuffix: string[]): boolean {
  if (dirParts.length < expectedSuffix.length) {
    return false
  }
  const lastParts = dirParts.slice(-expectedSuffix.length)
  return lastParts.every((part, index) => part === expectedSuffix[index])
}

export default rule
