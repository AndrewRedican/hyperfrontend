import type { TSESTree } from '@typescript-eslint/utils'
import { dirname } from 'node:path'
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'
import { findProjectRoot, isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the no-unsafe-builtin-methods rule.
 */
export const RULE_NAME = 'no-unsafe-builtin-methods'

// Package name for immutable-api-utils
const PKG = '@hyperfrontend/immutable-api-utils'

// Secondary entrypoint paths
const OBJECT = `${PKG}/built-in-copy/object`
const ARRAY = `${PKG}/built-in-copy/array`
const JSON_COPY = `${PKG}/built-in-copy/json`
const PROMISE = `${PKG}/built-in-copy/promise`

type SafeImport = { import: string; from: string }

/**
 * Maps unsafe method access to safe imports
 */
const UNSAFE_METHODS: Record<string, Record<string, SafeImport>> = {
  Object: Object.fromEntries(
    [
      'freeze',
      'create',
      'keys',
      'entries',
      'values',
      'fromEntries',
      'assign',
      'defineProperty',
      'defineProperties',
      'setPrototypeOf',
      'getPrototypeOf',
      'seal',
      'isFrozen',
      'isSealed',
      'isExtensible',
      'preventExtensions',
      'getOwnPropertyDescriptor',
      'getOwnPropertyNames',
      'getOwnPropertySymbols',
      'getOwnPropertyDescriptors',
    ].map((m) => [m, { import: m, from: OBJECT }])
  ),
  Array: Object.fromEntries(['isArray', 'from', 'of'].map((m) => [m, { import: m, from: ARRAY }])),
  JSON: Object.fromEntries(['parse', 'stringify'].map((m) => [m, { import: m, from: JSON_COPY }])),
}

// Add special cases with different import names
UNSAFE_METHODS['Object']['hasOwn'] = { import: 'hasOwn', from: OBJECT }

/**
 * Maps unsafe prototype method call patterns
 */
const UNSAFE_PROTOTYPE_CALLS: Record<string, SafeImport> = {
  'Object.prototype.hasOwnProperty': { import: 'hasOwn', from: OBJECT },
  'Object.prototype.toString': { import: 'typeTag', from: OBJECT },
}

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/docs/rules/${name}.md`)

type MessageIds = 'unsafeBuiltinMethod' | 'unsafePrototypeCall' | 'unsafeNewPromise'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: `Enforce use of safe built-in copies from ${PKG} to prevent prototype pollution attacks`,
    },
    schema: [],
    messages: {
      unsafeBuiltinMethod:
        "Use '{{ safeImport }}' from '{{ safeFrom }}' instead of direct '{{ unsafeAccess }}' access to protect against prototype pollution.",
      unsafePrototypeCall:
        "Use '{{ safeImport }}' from '{{ safeFrom }}' instead of '{{ unsafeAccess }}' to protect against prototype pollution.",
      unsafeNewPromise: `Use 'createPromise' from '${PROMISE}' instead of 'new Promise()' to protect against prototype pollution.`,
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename
    const fileDir = dirname(filename)
    const projectRoot = findProjectRoot(fileDir)

    // Only apply to publishable library projects
    if (!projectRoot || !isPublishableLibrary(projectRoot)) {
      return {}
    }

    // Exempt built-in-copy directory (these ARE the safe copies)
    if (filename.includes('built-in-copy')) {
      return {}
    }

    // Exempt test files
    if (filename.includes('.spec.') || filename.includes('.test.')) {
      return {}
    }

    return {
      // Check for Object.freeze, Array.isArray, JSON.parse, etc.
      MemberExpression(node: TSESTree.MemberExpression) {
        if (node.object.type !== AST_NODE_TYPES.Identifier) return
        if (node.property.type !== AST_NODE_TYPES.Identifier) return

        const objectName = node.object.name
        const methodName = node.property.name

        // Check static method access
        const objectMethods = UNSAFE_METHODS[objectName]
        if (objectMethods) {
          const safeMethod = objectMethods[methodName]
          if (safeMethod) {
            context.report({
              node,
              messageId: 'unsafeBuiltinMethod',
              data: {
                safeImport: safeMethod.import,
                safeFrom: safeMethod.from,
                unsafeAccess: `${objectName}.${methodName}`,
              },
            })
          }
        }
      },

      // Check for Object.prototype.hasOwnProperty.call, Object.prototype.toString.call
      CallExpression(node: TSESTree.CallExpression) {
        // Check for pattern: Object.prototype.hasOwnProperty.call(obj, key)
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.object.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.property.type === AST_NODE_TYPES.Identifier &&
          node.callee.property.name === 'call'
        ) {
          const innerMember = node.callee.object
          if (
            innerMember.object.type === AST_NODE_TYPES.MemberExpression &&
            innerMember.object.object.type === AST_NODE_TYPES.Identifier &&
            innerMember.object.property.type === AST_NODE_TYPES.Identifier &&
            innerMember.property.type === AST_NODE_TYPES.Identifier
          ) {
            const objectName = innerMember.object.object.name
            const prototypeName = innerMember.object.property.name
            const methodName = innerMember.property.name
            const fullPath = `${objectName}.${prototypeName}.${methodName}`

            const safeMethod = UNSAFE_PROTOTYPE_CALLS[fullPath]
            if (safeMethod) {
              context.report({
                node,
                messageId: 'unsafePrototypeCall',
                data: {
                  safeImport: safeMethod.import,
                  safeFrom: safeMethod.from,
                  unsafeAccess: `${fullPath}.call()`,
                },
              })
            }
          }
        }
      },

      // Check for new Promise()
      NewExpression(node: TSESTree.NewExpression) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'Promise') {
          context.report({
            node,
            messageId: 'unsafeNewPromise',
          })
        }
      },
    }
  },
})
