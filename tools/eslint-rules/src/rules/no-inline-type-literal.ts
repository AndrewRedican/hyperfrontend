import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-inline-type-literal rule.
 */
export const RULE_NAME = 'no-inline-type-literal'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the no-inline-type-literal rule.
 */
type MessageIds = 'noInlineTypeLiteral'

/**
 * Determines whether a TSTypeLiteral has at least one property or method
 * signature member. Empty `{}` and index-signature-only literals
 * (e.g., `{ [k: string]: T }`) are intentionally exempt because they have
 * no per-property names for JSDoc to attach to.
 *
 * @param node - The TSTypeLiteral node to inspect.
 * @returns True if the literal has at least one named-property member.
 */
function hasNamedMember(node: TSESTree.TSTypeLiteral): boolean {
  return node.members.some((member) => member.type === 'TSPropertySignature' || member.type === 'TSMethodSignature')
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prohibit inline anonymous object type literals at use sites; require a named `type` alias or `interface`',
    },
    schema: [],
    messages: {
      noInlineTypeLiteral:
        'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      TSTypeLiteral(node) {
        if (node.parent.type === 'TSTypeAliasDeclaration') return
        if (!hasNamedMember(node)) return

        context.report({ node, messageId: 'noInlineTypeLiteral' })
      },
    }
  },
})
