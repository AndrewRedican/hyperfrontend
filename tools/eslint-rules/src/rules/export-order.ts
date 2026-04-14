import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { compareImportSources } from '../utils/import-analysis'

/**
 * Rule identifier for the export-order rule.
 */
export const RULE_NAME = 'export-order'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the export-order rule.
 */
type MessageIds = 'incorrectOrder'

/**
 * Export from declarations (re-exports that have a source).
 */
type ExportFromDeclaration = TSESTree.ExportNamedDeclaration | TSESTree.ExportAllDeclaration

/**
 * Checks if an export declaration is a re-export (has a source).
 *
 * @param node - The export declaration node.
 * @returns True if the export has a source (is a re-export).
 */
function isExportFromSource(node: TSESTree.Node): node is ExportFromDeclaration {
  return (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && (node as ExportFromDeclaration).source !== null
}

/**
 * Checks if an export declaration is type-only.
 *
 * @param node - The export declaration node.
 * @returns True if the export is type-only.
 */
function isTypeOnlyExport(node: ExportFromDeclaration): boolean {
  if (node.type === 'ExportAllDeclaration') {
    return node.exportKind === 'type'
  }
  return node.exportKind === 'type'
}

/**
 * Gets the export source string from an export declaration.
 *
 * @param node - The export declaration node.
 * @returns The export source string.
 */
function getExportSource(node: ExportFromDeclaration): string {
  /* istanbul ignore next - source is always present when isExportFromSource is true */
  if (!node.source) return ''
  /* istanbul ignore next - source.value is always string for valid exports */
  return typeof node.source.value === 'string' ? node.source.value : ''
}

/**
 * Compares two exports for proper ordering.
 * Type exports come first, then ordered by source category.
 *
 * @param a - First export declaration.
 * @param b - Second export declaration.
 * @returns Comparison result for sorting.
 */
function compareExports(a: ExportFromDeclaration, b: ExportFromDeclaration): number {
  const aIsType = isTypeOnlyExport(a)
  const bIsType = isTypeOnlyExport(b)

  if (aIsType && !bIsType) return -1
  if (!aIsType && bIsType) return 1

  return compareImportSources(getExportSource(a), getExportSource(b))
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce export ordering (type-first, by source category)',
    },
    fixable: 'code',
    schema: [],
    messages: {
      incorrectOrder:
        'Exports are not in the correct order. Expected order: type exports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(node) {
        const exports = node.body.filter(isExportFromSource)

        if (exports.length <= 1) {
          return
        }

        const exportIndices = exports.map((exp) => node.body.indexOf(exp))
        /* istanbul ignore next - defensive: exportIndices always has values when exports.length > 1 */
        const firstIndex = exportIndices[0] ?? 0
        /* istanbul ignore next - defensive: exportIndices always has values when exports.length > 1 */
        const lastIndex = exportIndices[exportIndices.length - 1] ?? 0
        const isContiguous = lastIndex - firstIndex + 1 === exports.length

        const sortedExports = [...exports].sort(compareExports)
        const sourceCode = context.sourceCode

        let isOutOfOrder = false
        for (let i = 0; i < exports.length; i++) {
          if (exports[i] !== sortedExports[i]) {
            isOutOfOrder = true
            break
          }
        }

        if (!isOutOfOrder) {
          return
        }

        const firstExport = exports[0]
        /* istanbul ignore next - defensive check, exports.length >= 2 */
        if (!firstExport) {
          return
        }

        context.report({
          node: firstExport,
          messageId: 'incorrectOrder',
          fix: isContiguous
            ? (fixer) => {
                const exportTexts = sortedExports.map((exp) => {
                  const text = sourceCode.getText(exp)
                  return text
                })

                const lastExport = exports[exports.length - 1]
                /* istanbul ignore next - defensive check, exports.length >= 2 */
                if (!lastExport) {
                  return null
                }
                const rangeStart = firstExport.range[0]
                const rangeEnd = lastExport.range[1]

                const newText = exportTexts.join('\n')

                return fixer.replaceTextRange([rangeStart, rangeEnd], newText)
              }
            : null,
        })
      },
    }
  },
})
