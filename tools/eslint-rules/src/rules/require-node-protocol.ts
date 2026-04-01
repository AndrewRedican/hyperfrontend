import { ESLintUtils } from '@typescript-eslint/utils'
import { addNodePrefix, isNodeBuiltinWithoutPrefix } from '../utils/node-builtins'

/**
 * Rule identifier for the require-node-protocol rule.
 */
export const RULE_NAME = 'require-node-protocol'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'requireNodeProtocol'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require `node:` prefix for Node.js built-in module imports',
    },
    fixable: 'code',
    schema: [],
    messages: {
      requireNodeProtocol:
        "Import from '{{ source }}' must use '{{ fixed }}' prefix. Node.js built-in modules require the node: protocol for clarity and to avoid npm package name collisions.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value

        /* istanbul ignore next - defensive check for non-string source */
        if (typeof source !== 'string') {
          return
        }

        if (!isNodeBuiltinWithoutPrefix(source)) {
          return
        }

        const fixed = addNodePrefix(source)

        context.report({
          node: node.source,
          messageId: 'requireNodeProtocol',
          data: {
            source,
            fixed,
          },
          fix(fixer) {
            const raw = node.source.raw
            /* istanbul ignore else - raw is always defined for valid imports */
            if (raw) {
              const quote = raw[0]
              return fixer.replaceText(node.source, `${quote}${fixed}${quote}`)
            }
            /* istanbul ignore next - fallback for edge case */
            return fixer.replaceText(node.source, `'${fixed}'`)
          },
        })
      },
    }
  },
})
