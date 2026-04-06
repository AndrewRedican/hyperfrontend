import type { Rule } from 'eslint'
import type { ArrayExpression, Identifier, Node, ObjectExpression, Property, VariableDeclaration, VariableDeclarator } from 'estree'
import { basename, dirname, join } from 'node:path'
import { exists, findNxWorkspaceRoot } from '../utils'

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
  /** Category determining the route base path */
  category: 'core' | 'supporting' | 'utils' | 'plugin'
  /** The AST node for error reporting */
  node: ObjectExpression
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
 * @returns Array of library entries with slug and category.
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
      }
    }

    if (slug && category && name) {
      entries.push({
        name,
        slug,
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
      description: 'Ensure all libraries in the LIBRARIES array have a corresponding page.tsx route',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/docs-site-routes.md',
    },
    schema: [],
    messages: {
      missingRoute: "Library '{{ name }}' (slug: '{{ slug }}') is missing required page.tsx at {{ expectedPath }}",
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
          }
        }
      },
    }
  },
}

export default rule
