import type { Rule } from 'eslint'
import type { JSONNode, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-package-json-export rule.
 *
 * This rule ensures publishable libraries expose `./package.json` as an export.
 * Many tools (bundlers, TypeScript, package managers) need to read package.json
 * metadata. Without this export, the package.json file may be inaccessible when
 * the library is consumed via the `exports` field.
 */
export const RULE_NAME = 'lib-pkg-package-json-export'

const REQUIRED_EXPORT = './package.json'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require "./package.json" export in publishable library package.json files for tool compatibility',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-pkg-package-json-export.md',
    },
    schema: [],
    messages: {
      missingPackageJsonExport:
        'Publishable library package.json must export "./package.json" for tool compatibility. Add: "./package.json": "./package.json"',
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    // why: only publishable libraries are linted via config
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    let exportsNode: JSONProperty | null = null
    let hasPackageJsonExport = false

    return {
      JSONProperty(node: JSONNode) {
        // why: type guard for jsonc-eslint-parser
        if (node.type !== 'JSONProperty') {
          return
        }

        const key = node.key
        let keyName: string | null = null

        if (key.type === 'JSONIdentifier') {
          keyName = key.name
        } else if (key.type === 'JSONLiteral' && typeof key.value === 'string') {
          keyName = key.value
        }

        if (keyName === 'exports') {
          exportsNode = node
          const value = node.value
          if (value.type === 'JSONObjectExpression') {
            for (const prop of value.properties) {
              // why: type guard
              if (prop.type !== 'JSONProperty') continue
              const propKey = prop.key
              let propKeyName: string | null = null
              if (propKey.type === 'JSONIdentifier') {
                propKeyName = propKey.name
              } else if (propKey.type === 'JSONLiteral' && typeof propKey.value === 'string') {
                propKeyName = propKey.value
              }
              if (propKeyName === REQUIRED_EXPORT) {
                hasPackageJsonExport = true
              }
            }
          }
        }
      },

      'Program:exit'() {
        if (!exportsNode) {
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'missingPackageJsonExport',
          })
          return
        }

        if (!hasPackageJsonExport) {
          context.report({
            node: exportsNode as unknown as Rule.Node,
            messageId: 'missingPackageJsonExport',
          })
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
