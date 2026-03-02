import { ESLintUtils } from '@typescript-eslint/utils'

/**
 * Rule identifier for the prefer-angle-bracket-assertion rule.
 */
export const RULE_NAME = 'prefer-angle-bracket-assertion'

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/docs/rules/${name}.md`)

type MessageIds = 'preferAngleBracket'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce angle bracket syntax (`<T>value`) over `as` syntax (`value as T`) for type assertions',
    },
    schema: [],
    messages: {
      preferAngleBracket:
        "Type assertion using 'as' keyword is not allowed. Use angle bracket syntax '<{{ type }}>value' instead of 'value as {{ type }}'.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSAsExpression(node) {
        const sourceCode = context.sourceCode
        const typeAnnotation = node.typeAnnotation
        const typeText = sourceCode.getText(typeAnnotation)

        context.report({
          node,
          messageId: 'preferAngleBracket',
          data: {
            type: typeText,
          },
        })
      },
    }
  },
})
