import type { Rule } from 'eslint'
import type { ArrayExpression, Identifier, Node, ObjectExpression, Property, VariableDeclaration, VariableDeclarator } from 'estree'
import { basename, dirname, join } from 'node:path'
import { exists, findNxWorkspaceRoot, readFileIfExists } from '../utils'

/**
 * Rule identifier for the docs-site-routes rule.
 */
export const RULE_NAME = 'docs-site-routes'

/**
 * Represents a library entry extracted from the LIBRARIES array.
 */
export interface LibraryEntry {
  /** Display name */
  name: string
  /** URL slug (e.g., 'nexus', 'utils/data') */
  slug: string
  /** npm package name (e.g., '@hyperfrontend/nexus') */
  packageName: string | undefined
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
 * @returns Array of library entries with slug, packageName, and category.
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
    let packageName: string | null = null
    let category: string | null = null

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
      } else if (keyName === 'packageName') {
        packageName = getStringValue(prop.value as Node)
      } else if (keyName === 'category') {
        category = getStringValue(prop.value as Node)
      }
    }

    if (slug && category && name) {
      entries.push({
        name,
        slug,
        packageName: packageName ?? undefined,
        category: category as LibraryEntry['category'],
        node: objectExpr,
      })
    }
  }

  return entries
}

/**
 * Determines the expected route directory for a library.
 *
 * @param slug - The library slug.
 * @param category - The library category.
 * @returns The relative path from workspace root to the expected route directory.
 */
export function getExpectedRouteDir(slug: string, category: LibraryEntry['category']): string {
  const baseDir = category === 'plugin' ? 'apps/docs-site/src/app/docs/plugins' : 'apps/docs-site/src/app/docs/libraries'
  return join(baseDir, slug)
}

/**
 * Returns the expected href string as it would appear in navigation.ts.
 *
 * @param slug - The library slug.
 * @param category - The library category.
 * @returns The expected href token (e.g., "href: '/docs/libraries/nexus'").
 */
export function getExpectedNavHref(slug: string, category: LibraryEntry['category']): string {
  const base = category === 'plugin' ? '/docs/plugins' : '/docs/libraries'
  return `href: '${base}/${slug}'`
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
        'Ensure all libraries in the LIBRARIES array have a corresponding page.tsx route, navigation entry, and generate-docs entry',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/docs-site-routes.md',
    },
    schema: [],
    messages: {
      missingRoute: "Library '{{ name }}' (slug: '{{ slug }}') is missing required page.tsx at {{ expectedPath }}",
      missingNavigation: "Library '{{ name }}' (slug: '{{ slug }}') is missing navigation entry '{{ expectedHref }}' in navigation.ts",
      missingGenerateDocs: "Library '{{ name }}' (slug: '{{ slug }}') is missing from LIBRARIES array in generate-docs.ts",
      missingLibrarySlug: "Library '{{ name }}' (slug: '{{ slug }}') is missing from LIBRARY_SLUGS in generate-docs.ts",
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
    const generateDocsContent = readFileIfExists(join(workspaceRoot, 'apps/docs-site/scripts/generate-docs.ts'))

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
            const routeDir = getExpectedRouteDir(entry.slug, entry.category)
            const pagePath = join(workspaceRoot, routeDir, 'page.tsx')

            if (!exists(pagePath)) {
              context.report({
                node: entry.node as unknown as Rule.Node,
                messageId: 'missingRoute',
                data: {
                  name: entry.name,
                  slug: entry.slug,
                  expectedPath: join(routeDir, 'page.tsx'),
                },
              })
            }

            if (navigationContent !== null) {
              const expectedHref = getExpectedNavHref(entry.slug, entry.category)
              if (!navigationContent.includes(expectedHref)) {
                context.report({
                  node: entry.node as unknown as Rule.Node,
                  messageId: 'missingNavigation',
                  data: {
                    name: entry.name,
                    slug: entry.slug,
                    expectedHref,
                  },
                })
              }
            }

            if (generateDocsContent !== null && entry.packageName) {
              if (!generateDocsContent.includes(`packageName: '${entry.packageName}'`)) {
                context.report({
                  node: entry.node as unknown as Rule.Node,
                  messageId: 'missingGenerateDocs',
                  data: {
                    name: entry.name,
                    slug: entry.slug,
                  },
                })
              }
            }

            if (generateDocsContent !== null && (entry.category === 'core' || entry.category === 'supporting')) {
              const slugKey = entry.slug.includes('-') ? `'${entry.slug}'` : entry.slug
              const slugPattern = `${slugKey}: '${entry.slug}'`
              if (!generateDocsContent.includes(slugPattern)) {
                context.report({
                  node: entry.node as unknown as Rule.Node,
                  messageId: 'missingLibrarySlug',
                  data: {
                    name: entry.name,
                    slug: entry.slug,
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
