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
    // Track namespace imports for child_process module
    const childProcessNamespaceBindings = createSet<string>()

    // Track local names of execSync imports (in case of aliased imports)
    const execSyncLocalBindings = createSet<string>()

    return {
      // Check import declarations
      ImportDeclaration(node) {
        const source = node.source.value

        /* istanbul ignore if - source is always string in valid import declarations */
        if (typeof source !== 'string') {
          return
        }

        // Only process child_process imports
        if (!isChildProcessModule(source)) {
          return
        }

        for (const specifier of node.specifiers) {
          // Track namespace imports (import * as cp from 'child_process')
          if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
            childProcessNamespaceBindings.add(specifier.local.name)
          }

          // Check named imports for execSync
          if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
            const importedName = specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value

            if (importedName === 'execSync') {
              // Track the local name (handles aliased imports like `import { execSync as exec }`)
              execSyncLocalBindings.add(specifier.local.name)

              context.report({
                node: specifier,
                messageId: 'preferExecFileSync',
              })
            }
          }
        }
      },

      // Check for member expressions like cp.execSync()
      MemberExpression(node) {
        // Skip non-identifier objects (e.g., getCp().execSync, obj.cp.execSync)
        if (node.object.type !== AST_NODE_TYPES.Identifier) {
          return
        }

        const objectName = node.object.name

        // Check if this is a tracked child_process namespace
        if (!childProcessNamespaceBindings.has(objectName)) {
          return
        }

        let methodName: string | undefined

        // Handle cp.execSync (identifier property)
        if (node.property.type === AST_NODE_TYPES.Identifier) {
          methodName = node.property.name
        }
        // Handle cp['execSync'] (computed property with string literal)
        else if (node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string') {
          methodName = node.property.value
        }
        // Skip computed properties with non-string values (e.g., cp[variable])
        else {
          return
        }

        if (methodName === 'execSync') {
          context.report({
            node,
            messageId: 'preferExecFileSyncNamespace',
          })
        }
      },

      // Check for require() calls
      CallExpression(node) {
        // Check for require('child_process') destructuring patterns
        if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'require') {
          return
        }

        const arg = node.arguments[0]
        if (!arg || arg.type !== AST_NODE_TYPES.Literal || typeof arg.value !== 'string') {
          return
        }

        const source = arg.value

        // Only process child_process requires
        if (!isChildProcessModule(source)) {
          return
        }

        // Check if require is part of a variable declarator with destructuring
        // e.g., const { execSync } = require('child_process')
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
        }
        // Track if require result is assigned to a variable (namespace style)
        // e.g., const cp = require('child_process')
        else if (parent && parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
          childProcessNamespaceBindings.add(parent.id.name)
        }
      },
    }
  },
})
