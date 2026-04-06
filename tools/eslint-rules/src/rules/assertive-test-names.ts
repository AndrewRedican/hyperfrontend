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

type MessageIds = 'noShouldInTestName'

/**
 * Test function names that this rule checks (it and test variants only, not describe).
 */
const TEST_FUNCTION_NAMES = createSet(['it', 'test', 'fit', 'xit'])

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
        if (node.callee.type !== 'Identifier') {
          return
        }

        const functionName = node.callee.name
        if (!TEST_FUNCTION_NAMES.has(functionName)) {
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
          /* istanbul ignore next - cooked is always defined for valid template literals */
          const firstQuasi = <TSESTree.TemplateElement>firstArg.quasis[0]
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
