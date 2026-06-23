import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the jest-mock-after-imports rule.
 */
export const RULE_NAME = 'jest-mock-after-imports'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Jest mock-registration methods that Jest hoists above imports at runtime.
 * Placing them before imports in source is misleading, so they must be
 * written after all import statements.
 */
const MOCK_METHODS = createSet(['mock', 'unmock', 'enableAutomock', 'disableAutomock'])

/**
 * Message identifiers for the jest-mock-after-imports rule.
 */
type MessageIds = 'mockBeforeImport'

/**
 * A top-level statement paired with its index in the program body.
 */
type IndexedStatement = {
  /** The statement node. */
  node: TSESTree.ProgramStatement
  /** The position of the statement within the program body. */
  index: number
}

/**
 * A Jest mock-registration statement paired with its body index and matched method name.
 */
type MockStatement = {
  /** The statement node. */
  node: TSESTree.ProgramStatement
  /** The position of the statement within the program body. */
  index: number
  /** The matched Jest mock method name. */
  method: string
}

/**
 * Resolves the Jest mock method name for a statement, when it is a top-level
 * `jest.<method>(...)` call whose method registers or toggles module mocks.
 *
 * @param statement - The program-body statement to inspect.
 * @returns The matched method name, or null when the statement is not a Jest mock call.
 */
function getJestMockMethod(statement: TSESTree.ProgramStatement): string | null {
  if (statement.type !== AST_NODE_TYPES.ExpressionStatement) return null

  const expression = statement.expression
  if (expression.type !== AST_NODE_TYPES.CallExpression) return null

  const callee = expression.callee
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return null

  const object = callee.object
  if (object.type !== AST_NODE_TYPES.Identifier || object.name !== 'jest') return null

  const property = callee.property
  if (property.type !== AST_NODE_TYPES.Identifier) return null

  return MOCK_METHODS.has(property.name) ? property.name : null
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce that jest.mock() calls appear after all import statements',
    },
    fixable: 'code',
    schema: [],
    messages: {
      mockBeforeImport: 'jest.{{ method }}() must be placed after all import statements.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(node) {
        const imports: IndexedStatement[] = []
        const mocks: MockStatement[] = []

        node.body.forEach((statement, index) => {
          if (statement.type === AST_NODE_TYPES.ImportDeclaration) {
            imports.push({ node: statement, index })
            return
          }
          const method = getJestMockMethod(statement)
          if (method !== null) {
            mocks.push({ node: statement, index, method })
          }
        })

        if (imports.length === 0 || mocks.length === 0) {
          return
        }

        const lastImportIndex = imports[imports.length - 1].index
        const offendingMocks = mocks.filter((mock) => mock.index < lastImportIndex)

        if (offendingMocks.length === 0) {
          return
        }

        const block = [...imports, ...mocks].sort((a, b) => a.index - b.index)
        const firstNode = block[0].node
        const lastNode = block[block.length - 1].node
        // why: only reorder when imports and mocks form one unbroken leading block, otherwise a range replacement would drop an interleaved statement
        const isContiguous = block.length === block[block.length - 1].index - block[0].index + 1

        const sourceCode = context.sourceCode

        const fix = isContiguous
          ? (fixer: TSESLint.RuleFixer) => {
              const reordered = [...imports.map((entry) => entry.node), ...mocks.map((entry) => entry.node)]
              const newText = reordered.map((statement) => sourceCode.getText(statement)).join('\n')
              return fixer.replaceTextRange([firstNode.range[0], lastNode.range[1]], newText)
            }
          : null

        for (const mock of offendingMocks) {
          context.report({
            node: mock.node,
            messageId: 'mockBeforeImport',
            data: { method: mock.method },
            fix,
          })
        }
      },
    }
  },
})
