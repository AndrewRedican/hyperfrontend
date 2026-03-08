import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-no-main rule.
 */
export const RULE_NAME = 'lib-pkg-no-main'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow "main" field in publishable library package.json, require "exports" field instead',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-pkg-no-main.md',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noMainField: 'Do not use "main" field in publishable libraries. Use "exports" field instead: "exports": { ".": "./src/index.js" }',
      mainWithExports: 'Remove the "main" field. The "exports" field should be used instead for modern Node.js resolution.',
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    /* istanbul ignore next - only publishable libraries are linted via config */
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    let mainNode: JSONNode | null = null
    let mainValue: string | null = null
    let hasExports = false

    return {
      JSONProperty(node: JSONNode) {
        /* istanbul ignore if -- type guard for jsonc-eslint-parser */
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

        if (keyName === 'main') {
          mainNode = node
          if (node.value.type === 'JSONLiteral' && typeof node.value.value === 'string') {
            mainValue = node.value.value
          }
        }

        if (keyName === 'exports') {
          hasExports = true
        }
      },

      'Program:exit'() {
        if (!mainNode) {
          return
        }

        const sourceCode = context.sourceCode
        const mainNodeCast = mainNode as unknown as Rule.Node

        if (hasExports) {
          // Has both main and exports - just remove main
          context.report({
            node: mainNodeCast,
            messageId: 'mainWithExports',
            fix(fixer) {
              // Remove the entire main property including leading newline/indent and trailing comma
              const tokenAfter = sourceCode.getTokenAfter(mainNodeCast)
              const tokenBefore = sourceCode.getTokenBefore(mainNodeCast)
              const text = sourceCode.getText()

              // Check for trailing comma - remove from end of previous line to end of comma
              if (tokenAfter && (<{ value?: string }>tokenAfter).value === ',') {
                // Find the start of the line containing "main" (go back to previous newline)
                let startPos = mainNodeCast.range[0]
                while (startPos > 0 && text[startPos - 1] !== '\n') {
                  startPos--
                }
                // Include the newline before this line
                if (startPos > 0 && text[startPos - 1] === '\n') {
                  startPos--
                }
                return fixer.removeRange([startPos, tokenAfter.range[1]])
              }

              // Check for leading comma (if main is not the first property)
              if (tokenBefore && (<{ value?: string }>tokenBefore).value === ',') {
                return fixer.removeRange([tokenBefore.range[0], mainNodeCast.range[1]])
              }

              return fixer.remove(mainNodeCast)
            },
          })
        } else {
          // Has main but no exports - report error with suggestion
          // Auto-fix is complex here as we'd need to add a new exports field
          // For safety, we just report and let the developer fix it
          context.report({
            node: mainNodeCast,
            messageId: 'noMainField',
            fix(fixer) {
              // If we have the main value, we can transform main to exports
              if (mainValue) {
                const mainNodeTyped = <{ range: [number, number] }>(<unknown>mainNode)
                const replacement = `"exports": {\n    ".": "${mainValue}"\n  }`
                return fixer.replaceTextRange(mainNodeTyped.range, replacement)
              }
              return null
            },
          })
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
