import type { TSESTree } from '@typescript-eslint/utils'
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the no-direct-console rule.
 */
export const RULE_NAME = 'no-direct-console'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Console-related methods that should be flagged.
 */
const CONSOLE_METHODS = createSet([
  'log',
  'warn',
  'error',
  'info',
  'debug',
  'trace',
  'dir',
  'table',
  'assert',
  'clear',
  'count',
  'countReset',
  'group',
  'groupCollapsed',
  'groupEnd',
  'time',
  'timeEnd',
  'timeLog',
  'timeStamp',
  'profile',
  'profileEnd',
])

/**
 * Common logger methods that should be flagged when used from disallowed sources.
 */
const LOGGER_METHODS = createSet(['log', 'warn', 'error', 'info', 'debug', 'fatal', 'verbose', 'silly'])

/**
 * Import source patterns that are disallowed.
 */
const DISALLOWED_IMPORT_SOURCES = {
  nxDevkitLogger: '@nx/devkit',
  immutableConsole: '@hyperfrontend/immutable-api-utils/built-in-copy/console',
}

/**
 * The approved logging library.
 */
const LOGGING_LIBRARY = '@hyperfrontend/logging'

type MessageIds = 'noGlobalConsole' | 'noNxDevkitLogger' | 'noImmutableConsole' | 'noDisallowedLoggerUsage'

/**
 * Checks if an import source is the approved logging library or its subpaths.
 *
 * @param source - The import source string.
 * @returns Whether it's from the approved logging library.
 */
function isFromLoggingLibrary(source: string): boolean {
  return source === LOGGING_LIBRARY || source.startsWith(`${LOGGING_LIBRARY}/`)
}

/**
 * Checks if an import source is the nx/devkit logger.
 *
 * @param source - The import source string.
 * @returns Whether it's from nx/devkit.
 */
function isFromNxDevkit(source: string): boolean {
  return source === DISALLOWED_IMPORT_SOURCES.nxDevkitLogger
}

/**
 * Checks if an import source is the immutable-api-utils console.
 *
 * @param source - The import source string.
 * @returns Whether it's from immutable-api-utils console.
 */
function isFromImmutableConsole(source: string): boolean {
  return source === DISALLOWED_IMPORT_SOURCES.immutableConsole
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce using @hyperfrontend/logging instead of console.*, @nx/devkit logger, or @hyperfrontend/immutable-api-utils console methods',
    },
    schema: [],
    messages: {
      noGlobalConsole: "Avoid using global 'console.{{ method }}'. Use '@hyperfrontend/logging' APIs instead (e.g., createLogger, logger).",
      noNxDevkitLogger:
        "Avoid importing 'logger' from '@nx/devkit'. Use '@hyperfrontend/logging' APIs instead (e.g., createLogger, logger).",
      noImmutableConsole:
        "Avoid importing from '@hyperfrontend/immutable-api-utils/built-in-copy/console'. Use '@hyperfrontend/logging' APIs instead.",
      noDisallowedLoggerUsage: "Avoid using '{{ name }}' from disallowed source. Use '@hyperfrontend/logging' APIs instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    const nxDevkitLoggerBindings = createSet<string>()
    const immutableConsoleBindings = createSet<string>()
    const loggingLibraryBindings = createSet<string>()

    /**
     * Checks if a node is being passed as an argument to a logging library function.
     * This allows patterns like `createLogger(console.error, console.warn, ...)`.
     *
     * @param node - The AST node to check.
     * @param bindings - Set of identifiers imported from the logging library.
     * @returns Whether the node is an argument to a logging library call.
     */
    function isArgumentToLoggingLibraryCall(node: TSESTree.Node, bindings: Set<string>): boolean {
      const parent = node.parent
      if (!parent || parent.type !== AST_NODE_TYPES.CallExpression) {
        return false
      }
      if (parent.callee.type === AST_NODE_TYPES.Identifier && bindings.has(parent.callee.name)) {
        return true
      }
      return false
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value

        /* istanbul ignore if -- source is always string in valid import declarations */
        if (typeof source !== 'string') {
          return
        }

        if (isFromLoggingLibrary(source)) {
          for (const specifier of node.specifiers) {
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
              loggingLibraryBindings.add(specifier.local.name)
            } else if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
              loggingLibraryBindings.add(specifier.local.name)
            } else if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
              loggingLibraryBindings.add(specifier.local.name)
            }
          }
          return
        }

        if (isFromImmutableConsole(source)) {
          for (const specifier of node.specifiers) {
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
              immutableConsoleBindings.add(specifier.local.name)
            } else if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
              immutableConsoleBindings.add(specifier.local.name)
            }
          }
          return
        }

        if (isFromNxDevkit(source)) {
          for (const specifier of node.specifiers) {
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
              const importedName =
                specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value

              if (importedName === 'logger') {
                context.report({
                  node: specifier,
                  messageId: 'noNxDevkitLogger',
                })
                nxDevkitLoggerBindings.add(specifier.local.name)
              }
            }
          }
          return
        }
      },

      MemberExpression(node) {
        if (node.object.type !== AST_NODE_TYPES.Identifier) {
          return
        }

        const objectName = node.object.name

        if (loggingLibraryBindings.has(objectName)) {
          return
        }

        if (objectName === 'console') {
          let methodName: string | undefined

          if (node.property.type === AST_NODE_TYPES.Identifier) {
            methodName = node.property.name
          } else if (node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string') {
            methodName = node.property.value
          }

          if (methodName && CONSOLE_METHODS.has(methodName)) {
            if (isArgumentToLoggingLibraryCall(node, loggingLibraryBindings)) {
              return
            }
            context.report({
              node,
              messageId: 'noGlobalConsole',
              data: { method: methodName },
            })
          }
          return
        }

        if (nxDevkitLoggerBindings.has(objectName)) {
          let methodName: string | undefined

          if (node.property.type === AST_NODE_TYPES.Identifier) {
            methodName = node.property.name
          } else if (node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string') {
            methodName = node.property.value
          }

          if (methodName && LOGGER_METHODS.has(methodName)) {
            context.report({
              node,
              messageId: 'noDisallowedLoggerUsage',
              data: { name: `${objectName}.${methodName}` },
            })
          }
          return
        }

        if (immutableConsoleBindings.has(objectName)) {
          let methodName: string | undefined

          if (node.property.type === AST_NODE_TYPES.Identifier) {
            methodName = node.property.name
          }

          context.report({
            node,
            messageId: 'noDisallowedLoggerUsage',
            data: { name: methodName ? `${objectName}.${methodName}` : objectName },
          })
          return
        }
      },

      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier) {
          const calleeName = node.callee.name

          if (loggingLibraryBindings.has(calleeName)) {
            return
          }

          if (immutableConsoleBindings.has(calleeName)) {
            context.report({
              node,
              messageId: 'noDisallowedLoggerUsage',
              data: { name: calleeName },
            })
            return
          }

          if (calleeName === 'require') {
            const arg = node.arguments[0]
            if (arg && arg.type === AST_NODE_TYPES.Literal && typeof arg.value === 'string') {
              if (isFromImmutableConsole(arg.value)) {
                context.report({
                  node,
                  messageId: 'noImmutableConsole',
                })
              }
            }
          }
        }
      },
    }
  },
})
