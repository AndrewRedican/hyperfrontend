import type { Rule } from 'eslint'
import type { ArrayExpression, Identifier, Node, ObjectExpression, Property, VariableDeclaration, VariableDeclarator } from 'estree'
import { basename, dirname, join } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists, findNxWorkspaceRoot, readFileIfExists, readJsonFileIfExists } from '../utils'

/**
 * Rule identifier for the docs-site-secondary-entries rule.
 */
export const RULE_NAME = 'docs-site-secondary-entries'

/**
 * Categories that map to the `/docs/libraries/{slug}` route base.
 */
type LibraryCategory = 'core' | 'supporting' | 'utils' | 'plugin'

/**
 * Represents a library entry extracted from the LIBRARIES array.
 */
export interface LibraryEntry {
  /** Display name */
  name: string
  /** URL slug (e.g., 'nexus', 'utils/data') */
  slug: string
  /** Library root path relative to workspace, derived from readmePath (e.g., 'libs/versioning') */
  libraryRoot: string
  /** Category determining the route base path */
  category: LibraryCategory
  /** The AST node for error reporting */
  node: ObjectExpression
}

/**
 * Shape of a parsed package.json for the purposes of this rule.
 */
interface PackageJson {
  /** Subpath exports map declaring secondary entrypoints */
  exports?: Record<string, unknown> | string
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
 * Captures `name`, `slug`, `category`, and derives `libraryRoot` from `readmePath`.
 *
 * @param arrayExpression - The ArrayExpression AST node.
 * @returns Array of library entries with library root and category.
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
      entries.push({
        name,
        slug,
        libraryRoot: dirname(readmePath),
        category: category as LibraryCategory,
        node: objectExpr,
      })
    }
  }

  return entries
}

/**
 * Extracts the secondary entrypoint subpaths from a package.json `exports` map.
 * Filters out the primary entrypoint (`.`), the `package.json` re-export, and any
 * glob-style keys (`./*`) which are not concrete subpaths.
 *
 * @param packageJson - The parsed package.json object, or null when missing.
 * @returns Array of subpaths like `'commits/parse'` (no leading `./`).
 *
 * @example
 * extractSecondaryEntrySubpaths({ exports: { '.': './src/index.js', './commits/parse': './src/commits/parse/index.js' } })
 * // ['commits/parse']
 */
export function extractSecondaryEntrySubpaths(packageJson: PackageJson | null): string[] {
  if (!packageJson || !packageJson.exports || typeof packageJson.exports !== 'object') {
    return []
  }

  const subpaths: string[] = []

  for (const key of keys(packageJson.exports)) {
    if (key === '.' || key === './package.json') {
      continue
    }

    if (!key.startsWith('./')) {
      continue
    }

    if (key.includes('*')) {
      continue
    }

    subpaths.push(key.slice(2))
  }

  return subpaths
}

/**
 * Determines the expected route directory for a secondary entrypoint.
 *
 * @param slug - The library slug.
 * @param category - The library category.
 * @param subpath - The secondary entrypoint subpath (no leading `./`).
 * @returns Workspace-relative directory path where the page.tsx is expected.
 */
export function getExpectedSecondaryRouteDir(slug: string, category: LibraryCategory, subpath: string): string {
  const baseDir = category === 'plugin' ? 'apps/docs-site/src/app/docs/plugins' : 'apps/docs-site/src/app/docs/libraries'
  return join(baseDir, slug, subpath)
}

/**
 * Returns the expected href string as it would appear in navigation.ts.
 *
 * @param slug - The library slug.
 * @param category - The library category.
 * @param subpath - The secondary entrypoint subpath (no leading `./`).
 * @returns The expected href token (e.g., "href: '/docs/libraries/versioning/commits/parse'").
 */
export function getExpectedSecondaryNavHref(slug: string, category: LibraryCategory, subpath: string): string {
  const base = category === 'plugin' ? '/docs/plugins' : '/docs/libraries'
  return `href: '${base}/${slug}/${subpath}'`
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
      description:
        'Ensure every secondary entrypoint declared in a library package.json has a corresponding page.tsx route and navigation entry in the docs-site',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/docs-site-secondary-entries.md',
    },
    schema: [],
    messages: {
      missingSecondaryRoute:
        "Library '{{ name }}' secondary entrypoint './{{ subpath }}' is missing required page.tsx at {{ expectedPath }}",
      missingSecondaryNavigation:
        "Library '{{ name }}' secondary entrypoint './{{ subpath }}' is missing navigation entry '{{ expectedHref }}' in navigation.ts",
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

    const navigationContent = readFileIfExists(join(workspaceRoot, 'apps/docs-site/src/lib/navigation.ts'))

    return {
      VariableDeclaration(node: Node) {
        const varDecl = node as VariableDeclaration

        if (varDecl.kind !== 'const') {
          return
        }

        const parent = (
          node as {
            /** Parent AST node, if present. */
            parent?: Node
          }
        ).parent
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
            const packageJsonPath = join(workspaceRoot, entry.libraryRoot, 'package.json')
            const packageJson = readJsonFileIfExists<PackageJson>(packageJsonPath)
            const subpaths = extractSecondaryEntrySubpaths(packageJson)

            for (const subpath of subpaths) {
              const routeDir = getExpectedSecondaryRouteDir(entry.slug, entry.category, subpath)
              const pagePath = join(workspaceRoot, routeDir, 'page.tsx')

              if (!exists(pagePath)) {
                context.report({
                  node: entry.node as unknown as Rule.Node,
                  messageId: 'missingSecondaryRoute',
                  data: {
                    name: entry.name,
                    subpath,
                    expectedPath: join(routeDir, 'page.tsx'),
                  },
                })
              }

              if (navigationContent !== null) {
                const expectedHref = getExpectedSecondaryNavHref(entry.slug, entry.category, subpath)
                if (!navigationContent.includes(expectedHref)) {
                  context.report({
                    node: entry.node as unknown as Rule.Node,
                    messageId: 'missingSecondaryNavigation',
                    data: {
                      name: entry.name,
                      subpath,
                      expectedHref,
                    },
                  })
                }
              }
            }
          }
        }
      },
    }
  },
}

export default rule
