import { ESLintUtils, TSESTree } from '@typescript-eslint/utils'

/**
 * Rule identifier for the assertive-test-names rule.
 */
export const RULE_NAME = 'assertive-test-names'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AnndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'noShouldInTestName'

/**
 * Test function names that this rule checks (it and test variants only, not describe).
 */
const TEST_FUNCTION_NAMES = new Set(['it', 'test', 'fit', 'xit'])

/**
 * Pattern to match the word "should" (case-insensitive, word boundary).
 */
const SHOULD_PATTERN = /\bshould\b/i

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
        // Check if the callee is an identifier with a test function name
        if (node.callee.type !== 'Identifier') {
          return
        }

        const functionName = node.callee.name
        if (!TEST_FUNCTION_NAMES.has(functionName)) {
          return
        }

        // Get the first argument (test description)
        const firstArg = node.arguments[0]
        if (!firstArg) {
          return
        }

        // Extract the string value from the first argument
        let testName: string | undefined

        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          testName = firstArg.value
        } else if (firstArg.type === 'TemplateLiteral' && firstArg.quasis.length === 1) {
          // Simple template literal without expressions
          /* istanbul ignore next - cooked is always defined for valid template literals */
          testName = firstArg.quasis[0].value.cooked ?? firstArg.quasis[0].value.raw
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
