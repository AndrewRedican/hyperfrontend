import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { isTestFunctionCallee } from '../utils/test-declarations'

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
          // why: cooked is always defined for valid template literals
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
