import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * Rule identifier for the lib-pkg-no-main rule.
 */
export const RULE_NAME = 'lib-pkg-no-main'

/**
 * Minimal token shape exposing the optional `value` string ESLint attaches to tokens.
 */
type TokenWithValue = {
  /** Token string value */
  value?: string
}

/**
 * Minimal node shape exposing the `[start, end]` source range used by ESLint fixers.
 */
type NodeWithRange = {
  /** Source range as [start, end] positions */
  range: [number, number]
}

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
          context.report({
            node: mainNodeCast,
            messageId: 'mainWithExports',
            fix(fixer) {
              const tokenAfter = sourceCode.getTokenAfter(mainNodeCast)
              const tokenBefore = sourceCode.getTokenBefore(mainNodeCast)
              const text = sourceCode.getText()
              const range = <[number, number]>mainNodeCast.range

              if (tokenAfter && (<TokenWithValue>tokenAfter).value === ',') {
                let startPos = range[0]
                while (startPos > 0 && text[startPos - 1] !== '\n') {
                  startPos--
                }
                if (startPos > 0 && text[startPos - 1] === '\n') {
                  startPos--
                }
                return fixer.removeRange([startPos, tokenAfter.range[1]])
              }

              if (tokenBefore && (<TokenWithValue>tokenBefore).value === ',') {
                return fixer.removeRange([tokenBefore.range[0], range[1]])
              }

              return fixer.remove(mainNodeCast)
            },
          })
        } else {
          context.report({
            node: mainNodeCast,
            messageId: 'noMainField',
            fix(fixer) {
              if (mainValue) {
                const mainNodeTyped = <NodeWithRange>(<unknown>mainNode)
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
