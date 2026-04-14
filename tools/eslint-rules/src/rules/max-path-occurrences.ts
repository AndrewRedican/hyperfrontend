import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/**
 * Rule identifier for the max-path-occurrences rule.
 */
export const RULE_NAME = 'max-path-occurrences'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the max-path-occurrences rule.
 */
type MessageIds = 'tooManyImports' | 'tooManyExports'

/**
 * Tracks path occurrences by kind (type vs value) with the nodes that reference them.
 */
interface PathOccurrence {
  /** Nodes for type imports/exports */
  typeNodes: TSESTree.Node[]
  /** Nodes for value imports/exports */
  valueNodes: TSESTree.Node[]
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Limit the number of import and export statements per module path to 2',
    },
    schema: [],
    messages: {
      tooManyImports: 'Multiple {{kind}} import statements from "{{path}}" ({{count}} found). Consolidate into a single {{kind}} import.',
      tooManyExports: 'Multiple {{kind}} export statements from "{{path}}" ({{count}} found). Consolidate into a single {{kind}} export.',
    },
  },
  defaultOptions: [],
  create(context) {
    const importPaths = createMap<string, PathOccurrence>()
    const exportPaths = createMap<string, PathOccurrence>()

    /**
     * Records a path occurrence by kind.
     *
     * @param map - The map to record the occurrence in.
     * @param path - The module path.
     * @param node - The AST node.
     * @param isType - Whether this is a type import/export.
     */
    function recordPath(map: Map<string, PathOccurrence>, path: string, node: TSESTree.Node, isType: boolean): void {
      const existing = map.get(path)
      if (existing) {
        if (isType) {
          existing.typeNodes.push(node)
        } else {
          existing.valueNodes.push(node)
        }
      } else {
        map.set(path, {
          typeNodes: isType ? [node] : [],
          valueNodes: isType ? [] : [node],
        })
      }
    }

    /**
     * Gets the source path from a literal node.
     *
     * @param source - The source literal node.
     * @returns The path string or null if invalid.
     */
    function getSourcePath(source: TSESTree.Literal | TSESTree.StringLiteral | null): string | null {
      /* istanbul ignore if -- defensive check; import/export sources are always string literals in valid ASTs */
      if (!source || typeof source.value !== 'string') {
        return null
      }
      return source.value
    }

    return {
      ImportDeclaration(node) {
        const path = getSourcePath(node.source)
        /* istanbul ignore else -- getSourcePath only returns null for malformed ASTs */
        if (path) {
          recordPath(importPaths, path, node, node.importKind === 'type')
        }
      },

      ExportNamedDeclaration(node) {
        if (!node.source) {
          return
        }
        const path = getSourcePath(node.source)
        /* istanbul ignore else -- getSourcePath only returns null for malformed ASTs */
        if (path) {
          recordPath(exportPaths, path, node, node.exportKind === 'type')
        }
      },

      ExportAllDeclaration(node) {
        const path = getSourcePath(node.source)
        /* istanbul ignore else -- getSourcePath only returns null for malformed ASTs */
        if (path) {
          recordPath(exportPaths, path, node, node.exportKind === 'type')
        }
      },

      'Program:exit'() {
        for (const [path, occurrence] of importPaths) {
          if (occurrence.typeNodes.length > 1) {
            for (const node of occurrence.typeNodes) {
              context.report({
                node,
                messageId: 'tooManyImports',
                data: {
                  path,
                  kind: 'type',
                  count: String(occurrence.typeNodes.length),
                },
              })
            }
          }
          if (occurrence.valueNodes.length > 1) {
            for (const node of occurrence.valueNodes) {
              context.report({
                node,
                messageId: 'tooManyImports',
                data: {
                  path,
                  kind: 'value',
                  count: String(occurrence.valueNodes.length),
                },
              })
            }
          }
        }

        for (const [path, occurrence] of exportPaths) {
          if (occurrence.typeNodes.length > 1) {
            for (const node of occurrence.typeNodes) {
              context.report({
                node,
                messageId: 'tooManyExports',
                data: {
                  path,
                  kind: 'type',
                  count: String(occurrence.typeNodes.length),
                },
              })
            }
          }
          if (occurrence.valueNodes.length > 1) {
            for (const node of occurrence.valueNodes) {
              context.report({
                node,
                messageId: 'tooManyExports',
                data: {
                  path,
                  kind: 'value',
                  count: String(occurrence.valueNodes.length),
                },
              })
            }
          }
        }
      },
    }
  },
})
