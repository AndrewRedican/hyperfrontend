import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the prefer-exec-file-sync rule.
 */
export const RULE_NAME = 'prefer-exec-file-sync'

/**
 * Module patterns for child_process (with or without node: prefix)
 */
const CHILD_PROCESS_MODULE_PATTERNS = ['child_process', 'node:child_process']

/**
 * Checks if the source string is a child_process module import.
 *
 * @param source - The import source string
 * @returns True if it's a child_process module
 */
function isChildProcessModule(source: string): boolean {
  return CHILD_PROCESS_MODULE_PATTERNS.some((pattern) => source === pattern)
}

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/** Message identifiers for rule violations. */
type MessageIds = 'preferExecFileSync' | 'preferExecFileSyncNamespace'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer `execFileSync` over `execSync` for safer command execution',
    },
    schema: [],
    messages: {
      preferExecFileSync:
        "Avoid using 'execSync'. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
      preferExecFileSyncNamespace:
        "Avoid using 'execSync' via namespace access. Use 'execFileSync' instead for safer command execution (prevents shell injection and avoids shell parsing issues).",
    },
  },
  defaultOptions: [],
  create(context) {
    const childProcessNamespaceBindings = createSet<string>()

    const execSyncLocalBindings = createSet<string>()

    return {
      ImportDeclaration(node) {
        const source = node.source.value

        // why: source is always string in valid import declarations
        if (typeof source !== 'string') {
          return
        }

        if (!isChildProcessModule(source)) {
          return
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
            childProcessNamespaceBindings.add(specifier.local.name)
          }

          if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
            const importedName = specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value

            if (importedName === 'execSync') {
              execSyncLocalBindings.add(specifier.local.name)

              context.report({
                node: specifier,
                messageId: 'preferExecFileSync',
              })
            }
          }
        }
      },

      MemberExpression(node) {
        if (node.object.type !== AST_NODE_TYPES.Identifier) {
          return
        }

        const objectName = node.object.name

        if (!childProcessNamespaceBindings.has(objectName)) {
          return
        }

        let methodName: string | undefined

        if (node.property.type === AST_NODE_TYPES.Identifier) {
          methodName = node.property.name
        } else if (node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string') {
          methodName = node.property.value
        } else {
          return
        }

        if (methodName === 'execSync') {
          context.report({
            node,
            messageId: 'preferExecFileSyncNamespace',
          })
        }
      },

      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'require') {
          return
        }

        const arg = node.arguments[0]
        if (!arg || arg.type !== AST_NODE_TYPES.Literal || typeof arg.value !== 'string') {
          return
        }

        const source = arg.value

        if (!isChildProcessModule(source)) {
          return
        }

        const parent = node.parent
        if (parent && parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.ObjectPattern) {
          for (const prop of parent.id.properties) {
            if (prop.type === AST_NODE_TYPES.Property && prop.key.type === AST_NODE_TYPES.Identifier && prop.key.name === 'execSync') {
              context.report({
                node: prop,
                messageId: 'preferExecFileSync',
              })
            }
          }
        } else if (parent && parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
          childProcessNamespaceBindings.add(parent.id.name)
        }
      },
    }
  },
})
