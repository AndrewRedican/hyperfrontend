import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the assertive-test-names rule.
 */
export const RULE_NAME = 'assertive-test-names'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the assertive-test-names rule.
 */
type MessageIds = 'noShouldInTestName'

/**
 * Test function names that this rule checks (it and test variants only, not describe).
 */
const TEST_FUNCTION_NAMES = createSet(['it', 'test', 'fit', 'xit', 'xtest'])

/**
 * Modifier properties that keep a member call within the test-function family (e.g. it.only, test.each).
 */
const TEST_MODIFIER_NAMES = createSet(['only', 'skip', 'todo', 'failing', 'concurrent', 'each'])

/**
 * Pattern to match the word "should" (case-insensitive, word boundary).
 */
const SHOULD_PATTERN = /\bshould\b/i

/**
 * Determines whether a callee refers to one of the checked test functions, including modifier
 * chains such as `it.only` and table forms such as `it.each(table)(...)` and `` it.each`table`(...) ``.
 *
 * @param node - Callee expression of the call being inspected.
 * @returns True when the call names a test whose description this rule checks.
 */
function isTestFunctionCallee(node: TSESTree.Node): boolean {
  if (node.type === 'Identifier') {
    return TEST_FUNCTION_NAMES.has(node.name)
  }
  if (node.type === 'MemberExpression') {
    return node.property.type === 'Identifier' && TEST_MODIFIER_NAMES.has(node.property.name) && isTestFunctionCallee(node.object)
  }
  if (node.type === 'CallExpression') {
    return isEachOfTestFunction(node.callee)
  }
  if (node.type === 'TaggedTemplateExpression') {
    return isEachOfTestFunction(node.tag)
  }
  return false
}

/**
 * Determines whether an expression is an `each` member access on a checked test-function chain,
 * as produced by `it.each(table)` or `` it.each`table` ``.
 *
 * @param node - Callee or tag expression to inspect.
 * @returns True when the expression selects `each` from a checked test function.
 */
function isEachOfTestFunction(node: TSESTree.Node): boolean {
  return (
    node.type === 'MemberExpression' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'each' &&
    isTestFunctionCallee(node.object)
  )
}

export const assertiveTestNames = createRule<[], MessageIds>({
  name: 'assertive-test-names',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prohibit the word "should" in test descriptions',
    },
    schema: [],
    messages: {
      noShouldInTestName:
        'Test names should be assertive statements of fact. Avoid using "should" - use direct verbs like "returns", "throws", "handles" instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isTestFunctionCallee(node.callee)) {
          return
        }

        const firstArg = node.arguments[0]
        if (!firstArg) {
          return
        }

        let testName: string | undefined

        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          testName = firstArg.value
        } else if (firstArg.type === 'TemplateLiteral' && firstArg.quasis.length === 1) {
          const firstQuasi = firstArg.quasis[0] as TSESTree.TemplateElement
          /* istanbul ignore next - cooked is always defined for valid template literals */
          testName = firstQuasi.value.cooked ?? firstQuasi.value.raw
        }

        if (testName && SHOULD_PATTERN.test(testName)) {
          context.report({
            node: firstArg,
            messageId: 'noShouldInTestName',
          })
        }
      },
    }
  },
})

export default assertiveTestNames
