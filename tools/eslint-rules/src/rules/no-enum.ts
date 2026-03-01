import { ESLintUtils } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-enum rule.
 */
export const RULE_NAME = 'no-enum'

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/docs/rules/${name}.md`)

type MessageIds = 'noEnum'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prohibit the `enum` keyword in favor of frozen const objects',
    },
    schema: [],
    messages: {
      noEnum:
        "The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const {{ name }} = freeze(<const>{ Key: 'value' })",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSEnumDeclaration(node) {
        const enumName = node.id.name

        context.report({
          node,
          messageId: 'noEnum',
          data: {
            name: enumName,
          },
        })
      },
    }
  },
})
