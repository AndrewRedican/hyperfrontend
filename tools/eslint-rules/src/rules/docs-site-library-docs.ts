import type { Rule } from 'eslint'
import type { ArrayExpression, Identifier, Node, ObjectExpression, Property, VariableDeclaration, VariableDeclarator } from 'estree'
import { basename, dirname, join, relative } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, findNxWorkspaceRoot, isDirectory, readDirectory } from '../utils'

/**
 * Rule identifier for the docs-site-library-docs rule.
 */
export const RULE_NAME = 'docs-site-library-docs'

/**
 * Markdown files to exclude from documentation requirements.
 * These are typically auto-generated or not user-facing documentation.
 */
const EXCLUDED_MARKDOWN_FILES = createSet(['CHANGELOG.md', 'LICENSE.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md'])

/**
 * Directories to skip when scanning for markdown files.
 */
const EXCLUDED_DIRECTORIES = createSet(['node_modules', 'dist', '.git', 'coverage', '.nx'])

/**
 * Represents a markdown file found in a library.
 */
export interface MarkdownFile {
  /** Absolute path to the markdown file */
  absolutePath: string
  /** Path relative to the library root (e.g., 'ARCHITECTURE.md', 'src/core/README.md') */
  relativePath: string
  /** The expected docs-site route slug (e.g., 'architecture', 'core') */
  routeSlug: string
  /** Whether this is the main page (README.md at root) */
  isMainPage: boolean
}

/**
 * Represents a library entry extracted from the LIBRARIES array.
 */
export interface LibraryEntry {
  /** Display name */
  name: string
  /** URL slug (e.g., 'nexus', 'utils/data') */
  slug: string
  /** Library source path relative to workspace (e.g., 'libs/nexus', 'libs/utils/data') */
  srcPath: string
  /** Category determining the route base path */
  category: 'core' | 'supporting' | 'utils' | 'plugin'
  /** The AST node for error reporting */
  node: ObjectExpression
}

/**
 * Minimal AST helper exposing the optional `parent` reference attached to nodes
 * by ESLint at traversal time.
 */
type NodeWithParent = {
  /** Parent AST node, if present. */
  parent?: Node
}

/**
 * Extracts the string value from a property value node.
 *
 * @param node - The AST node representing the property value.
 * @returns The string value or null if not a string literal.
 */
function getStringValue(node: Node): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  return null
}

/**
 * Extracts library entries from the LIBRARIES array.
 *
 * @param arrayExpression - The ArrayExpression AST node.
 * @returns Array of library entries with slug, srcPath, and category.
 */
export function extractLibraryEntries(arrayExpression: ArrayExpression): LibraryEntry[] {
  const entries: LibraryEntry[] = []

  for (const element of arrayExpression.elements) {
    if (!element || element.type !== 'ObjectExpression') {
      continue
    }

    const objectExpr = element as ObjectExpression
    let name: string | null = null
    let slug: string | null = null
    let category: string | null = null
    let readmePath: string | null = null

    for (const property of objectExpr.properties) {
      if (property.type !== 'Property') {
        continue
      }

      const prop = property as Property
      let keyName: string | null = null

      if (prop.key.type === 'Identifier') {
        keyName = (prop.key as Identifier).name
      } else if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') {
        keyName = prop.key.value
      }

      if (!keyName) {
        continue
      }

      if (keyName === 'name') {
        name = getStringValue(prop.value as Node)
      } else if (keyName === 'slug') {
        slug = getStringValue(prop.value as Node)
      } else if (keyName === 'category') {
        category = getStringValue(prop.value as Node)
      } else if (keyName === 'readmePath') {
        readmePath = getStringValue(prop.value as Node)
      }
    }

    if (slug && category && name && readmePath) {
      const srcPath = dirname(readmePath)
      entries.push({
        name,
        slug,
        srcPath,
        category: category as LibraryEntry['category'],
        node: objectExpr,
      })
    }
  }

  return entries
}

/**
 * Recursively finds all markdown files in a directory.
 *
 * @param dirPath - The directory to search.
 * @param libraryRoot - The root path of the library.
 * @param results - Array to accumulate results.
 */
function findMarkdownFiles(dirPath: string, libraryRoot: string, results: MarkdownFile[]): void {
  if (!exists(dirPath) || !isDirectory(dirPath)) {
    return
  }

  let entries: string[]
  try {
    entries = readDirectory(dirPath)
  } catch /* istanbul ignore next -- error handling for filesystem issues */ {
    return
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry)) {
      continue
    }

    const entryPath = join(dirPath, entry)

    if (isDirectory(entryPath)) {
      findMarkdownFiles(entryPath, libraryRoot, results)
    } else if (entry.endsWith('.md') && !EXCLUDED_MARKDOWN_FILES.has(entry)) {
      const relativePath = relative(libraryRoot, entryPath)
      const mdFile = createMarkdownFileEntry(entryPath, relativePath)
      if (mdFile) {
        results.push(mdFile)
      }
    }
  }
}

/**
 * Creates a MarkdownFile entry from a file path.
 *
 * @param absolutePath - The absolute path to the markdown file.
 * @param relativePath - The path relative to the library root.
 * @returns A MarkdownFile entry or null if the file should be excluded.
 */
function createMarkdownFileEntry(absolutePath: string, relativePath: string): MarkdownFile | null {
  // why: Guide units under docs/guides/ are compiled by the docs-site generation pipeline into the global /docs/guides/[slug] route; generation itself fails on any guide directory that does not produce a rendered page, so the reachability invariant this rule protects is enforced there instead.
  if (relativePath.startsWith('docs/guides/')) {
    return null
  }

  const fileName = basename(relativePath)

  if (fileName === 'README.md') {
    const dirPath = dirname(relativePath)

    if (dirPath === '.') {
      return {
        absolutePath,
        relativePath,
        routeSlug: '',
        isMainPage: true,
      }
    }

    const routeSlug = computeRouteSlugFromDir(dirPath)
    return {
      absolutePath,
      relativePath,
      routeSlug,
      isMainPage: false,
    }
  }

  const routeSlug = computeRouteSlugFromFile(relativePath)
  return {
    absolutePath,
    relativePath,
    routeSlug,
    isMainPage: false,
  }
}

/**
 * Computes the route slug from a directory path.
 * Strips 'src/' prefix if present and converts to lowercase.
 *
 * @param dirPath - Directory path relative to library root.
 * @returns Lowercase path suitable for URL routing.
 *
 * @example
 * computeRouteSlugFromDir('src/core') // 'core'
 * computeRouteSlugFromDir('src/lib/channel') // 'lib/channel'
 * computeRouteSlugFromDir('examples') // 'examples'
 */
export function computeRouteSlugFromDir(dirPath: string): string {
  let slug = dirPath.toLowerCase()

  if (slug.startsWith('src/')) {
    slug = slug.slice(4)
  } else if (slug === 'src') {
    return ''
  }

  if (slug.startsWith('lib/')) {
    slug = slug.slice(4)
  } else if (slug === 'lib') {
    return ''
  }

  return slug
}

/**
 * Computes the route slug from a markdown file path.
 * Converts the file name (without .md) to lowercase.
 *
 * @param relativePath - File path relative to library root.
 * @returns Lowercase filename without extension for URL routing.
 *
 * @example
 * computeRouteSlugFromFile('ARCHITECTURE.md') // 'architecture'
 * computeRouteSlugFromFile('DESIGN.md') // 'design'
 */
export function computeRouteSlugFromFile(relativePath: string): string {
  const fileName = basename(relativePath, '.md')
  return fileName.toLowerCase()
}

/**
 * Gets all markdown files from a library that require documentation pages.
 *
 * @param libraryPath - Absolute path to the library root.
 * @returns Array of markdown files found.
 */
export function getLibraryMarkdownFiles(libraryPath: string): MarkdownFile[] {
  const results: MarkdownFile[] = []
  findMarkdownFiles(libraryPath, libraryPath, results)
  return results
}

/**
 * Determines the expected docs-site page path for a library markdown file.
 *
 * @param slug - The library slug.
 * @param category - The library category.
 * @param markdownFile - The markdown file information.
 * @returns The relative path from workspace root to the expected page.tsx.
 */
export function getExpectedPagePath(slug: string, category: LibraryEntry['category'], markdownFile: MarkdownFile): string {
  const baseDir = category === 'plugin' ? 'apps/docs-site/src/app/docs/plugins' : 'apps/docs-site/src/app/docs/libraries'

  if (markdownFile.isMainPage) {
    return join(baseDir, slug, 'page.tsx')
  }

  return join(baseDir, slug, markdownFile.routeSlug, 'page.tsx')
}

/**
 * Checks if the directory path ends with the expected suffix.
 *
 * @param dirParts - The directory path split by '/'.
 * @param expectedSuffix - Array of path segments to match at the end.
 * @returns True if the path ends with the expected suffix.
 */
function checkPathSuffix(dirParts: string[], expectedSuffix: string[]): boolean {
  if (dirParts.length < expectedSuffix.length) {
    return false
  }
  const lastParts = dirParts.slice(-expectedSuffix.length)
  return lastParts.every((part, index) => part === expectedSuffix[index])
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure all markdown files in publishable libraries have corresponding docs-site pages',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/docs-site-library-docs.md',
    },
    schema: [],
    messages: {
      missingDocPage: "Library '{{ name }}' markdown file '{{ markdownPath }}' is missing corresponding docs page at {{ expectedPath }}",
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = basename(filePath)
    const fileDir = dirname(filePath)
    const dirParts = fileDir.split('/')

    const isContentTs = fileName === 'content.ts' && checkPathSuffix(dirParts, ['apps', 'docs-site', 'src', 'lib'])

    if (!isContentTs) {
      return {}
    }

    const workspaceRoot = findNxWorkspaceRoot(fileDir)

    if (!workspaceRoot) {
      return {}
    }

    return {
      VariableDeclaration(node: Node) {
        const varDecl = node as VariableDeclaration

        if (varDecl.kind !== 'const') {
          return
        }

        const parent = (node as NodeWithParent).parent
        const isExported = parent?.type === 'ExportNamedDeclaration'

        if (!isExported) {
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
          const libraryEntries = extractLibraryEntries(arrayExpression)

          for (const entry of libraryEntries) {
            const libraryPath = join(workspaceRoot, entry.srcPath)
            const markdownFiles = getLibraryMarkdownFiles(libraryPath)

            for (const mdFile of markdownFiles) {
              const expectedPath = getExpectedPagePath(entry.slug, entry.category, mdFile)
              const fullExpectedPath = join(workspaceRoot, expectedPath)

              if (!exists(fullExpectedPath)) {
                context.report({
                  node: entry.node as unknown as Rule.Node,
                  messageId: 'missingDocPage',
                  data: {
                    name: entry.name,
                    markdownPath: mdFile.relativePath,
                    expectedPath,
                  },
                })
              }
            }
          }
        }
      },
    }
  },
}

export default rule
