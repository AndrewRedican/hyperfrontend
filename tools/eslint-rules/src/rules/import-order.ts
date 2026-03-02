import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { compareImportSources } from '../utils/import-analysis'

/**
 * Rule identifier for the import-order rule.
 */
export const RULE_NAME = 'import-order'

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/docs/rules/${name}.md`)

type MessageIds = 'incorrectOrder'

/**
 * Checks if an import declaration is type-only.
 *
 * @param node - The import declaration node.
 * @returns True if the import is type-only.
 */
function isTypeOnlyImport(node: TSESTree.ImportDeclaration): boolean {
  return node.importKind === 'type'
}

/**
 * Gets the import source string from an import declaration.
 *
 * @param node - The import declaration node.
 * @returns The import source string.
 */
function getImportSource(node: TSESTree.ImportDeclaration): string {
  /* istanbul ignore next - source.value is always string for valid imports */
  return typeof node.source.value === 'string' ? node.source.value : ''
}

/**
 * Compares two imports for proper ordering.
 * Type imports come first, then ordered by source category.
 *
 * @param a - First import declaration.
 * @param b - Second import declaration.
 * @returns Comparison result for sorting.
 */
function compareImports(a: TSESTree.ImportDeclaration, b: TSESTree.ImportDeclaration): number {
  const aIsType = isTypeOnlyImport(a)
  const bIsType = isTypeOnlyImport(b)

  // Type imports come first
  if (aIsType && !bIsType) return -1
  if (!aIsType && bIsType) return 1

  // Same type status: compare by source
  return compareImportSources(getImportSource(a), getImportSource(b))
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce import ordering (type-first, by source category)',
    },
    fixable: 'code',
    schema: [],
    messages: {
      incorrectOrder:
        'Imports are not in the correct order. Expected order: type imports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(node) {
        const imports = node.body.filter((statement): statement is TSESTree.ImportDeclaration => statement.type === 'ImportDeclaration')

        if (imports.length <= 1) {
          return
        }

        // Check if imports are contiguous (no non-import statements between them)
        // Only auto-fix if imports are contiguous to avoid destroying code between imports
        const importIndices = imports.map((imp) => node.body.indexOf(imp))
        /* istanbul ignore next - defensive: importIndices always has values when imports.length > 1 */
        const firstIndex = importIndices[0] ?? 0
        /* istanbul ignore next - defensive: importIndices always has values when imports.length > 1 */
        const lastIndex = importIndices[importIndices.length - 1] ?? 0
        const isContiguous = lastIndex - firstIndex + 1 === imports.length

        // Check if imports are in correct order
        const sortedImports = [...imports].sort(compareImports)
        const sourceCode = context.sourceCode

        // Find first out-of-order import
        let isOutOfOrder = false
        for (let i = 0; i < imports.length; i++) {
          if (imports[i] !== sortedImports[i]) {
            isOutOfOrder = true
            break
          }
        }

        if (!isOutOfOrder) {
          return
        }

        // Report on the first import with fix to reorder all
        const firstImport = imports[0]
        /* istanbul ignore next - defensive check, imports.length >= 2 */
        if (!firstImport) {
          return
        }

        context.report({
          node: firstImport,
          messageId: 'incorrectOrder',
          // Only provide auto-fix if imports are contiguous
          fix: isContiguous
            ? (fixer) => {
                // Get the text of each import including any comments before it
                const importTexts = sortedImports.map((imp) => {
                  const text = sourceCode.getText(imp)
                  return text
                })

                // Calculate the range to replace (from first import to last import)
                const lastImport = imports[imports.length - 1]
                /* istanbul ignore next - defensive check, imports.length >= 2 */
                if (!lastImport) {
                  return null
                }
                const rangeStart = firstImport.range[0]
                const rangeEnd = lastImport.range[1]

                // Join imports with newlines
                const newText = importTexts.join('\n')

                return fixer.replaceTextRange([rangeStart, rangeEnd], newText)
              }
            : null,
        })
      },
    }
  },
})
