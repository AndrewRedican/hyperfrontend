import type { Rule } from 'eslint'
import { basename, dirname } from 'node:path'
import { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME } from '@hyperfrontend/workspace'
import { findNxWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-compatibility-matrix rule.
 */
export const RULE_NAME = 'lib-compatibility-matrix'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Generate the root LIBRARY_COMPATIBILITY.md from each package project.json and package.json',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    fixable: 'code',
    schema: [],
    messages: {
      staleMatrix:
        'LIBRARY_COMPATIBILITY.md is generated from each package project.json and package.json, and no longer matches them. Run `npx nx lint:all` (or `nx lint @hyperfrontend/workspace --fix`) to regenerate it.',
    },
  },

  create(context) {
    const filePath = context.filename

    if (basename(filePath) !== COMPATIBILITY_DOCUMENT_NAME) {
      return {}
    }

    const fileDir = dirname(filePath)
    const workspaceRoot = findNxWorkspaceRoot(fileDir)

    if (!workspaceRoot || fileDir !== workspaceRoot) {
      return {}
    }

    return {
      root(node: Rule.Node) {
        const content = context.sourceCode.getText()
        const expected = buildCompatibilityDocument(workspaceRoot)

        if (content === expected) {
          return
        }

        context.report({
          node,
          messageId: 'staleMatrix',
          fix(fixer) {
            return fixer.replaceTextRange([0, content.length], expected)
          },
        })
      },
    }
  },
}

export default rule
