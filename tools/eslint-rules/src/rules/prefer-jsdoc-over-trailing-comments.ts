import type { TSESTree } from '@typescript-eslint/utils'
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint'
import { ESLintUtils } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the prefer-jsdoc-over-trailing-comments rule.
 */
export const RULE_NAME = 'prefer-jsdoc-over-trailing-comments'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'preferJsDocOverTrailing'

/**
 * Node types that represent members within interfaces.
 */
const INTERFACE_MEMBER_NODE_TYPES = createSet([
  'TSPropertySignature',
  'TSMethodSignature',
  'TSIndexSignature',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
])

/**
 * Gets the indentation string for a given line.
 *
 * @param sourceCode - The source code object.
 * @param line - The 1-based line number.
 * @returns The indentation string (spaces/tabs).
 */
function getIndentation(sourceCode: SourceCode, line: number): string {
  const lineText = sourceCode.getLines()[line - 1] || ''
  const match = lineText.match(/^(\s*)/)
  return match ? <string>match[1] : ''
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer JSDoc comments above members over trailing inline comments.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferJsDocOverTrailing:
        'Use a JSDoc comment above the member instead of a trailing inline comment. This allows documentation tools to collect the information correctly.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()

    /**
     * Checks if a node is a member inside an interface body.
     *
     * @param node - The AST node to check.
     * @returns True if it's an interface member node, false otherwise.
     */
    function isInterfaceMember(node: TSESTree.Node): boolean {
      if (!INTERFACE_MEMBER_NODE_TYPES.has(node.type)) return false
      const parent = node.parent
      if (!parent) return false
      return parent.type === 'TSInterfaceBody'
    }

    /**
     * Finds trailing line comments for a member node.
     * Handles cases where punctuation (like commas in object literals) appears between the node and comment.
     *
     * @param node - The AST node to check.
     * @returns An array of trailing comments for the node.
     */
    function findTrailingComments(node: TSESTree.Node): TSESTree.Comment[] {
      const nodeEndLine = node.loc.end.line
      const nodeEndColumn = node.loc.end.column
      const allComments = sourceCode.getAllComments()

      return allComments.filter((comment) => {
        // note: Must be a line comment on the same line as the node ends
        if (comment.type !== 'Line') return false
        if (comment.loc.start.line !== nodeEndLine) return false
        // note: Must appear after the node ends
        if (comment.loc.start.column <= nodeEndColumn) return false
        return true
      })
    }

    /**
     * Creates the JSDoc comment text from the trailing comment content.
     *
     * @param content - The content of the trailing comment.
     * @param indentation - The indentation string to use for the JSDoc comment.
     * @returns The formatted JSDoc comment text.
     */
    function createJsDocText(content: string, indentation: string): string {
      const trimmed = content.trim()
      return `${indentation}/** ${trimmed} */\n`
    }

    return {
      TSPropertySignature: checkMember,
      TSMethodSignature: checkMember,
      TSIndexSignature: checkMember,
      TSCallSignatureDeclaration: checkMember,
      TSConstructSignatureDeclaration: checkMember,
    }

    /**
     * Checks an interface member node for trailing comments and reports/fixes them to use JSDoc instead.
     *
     * @param node - The interface member node to check.
     */
    function checkMember(node: TSESTree.Node) {
      if (!isInterfaceMember(node)) return

      const trailingComments = findTrailingComments(node)
      if (trailingComments.length === 0) return

      // note: Process from last to first to handle multiple comments
      for (const comment of trailingComments) {
        const indentation = getIndentation(sourceCode, node.loc.start.line)
        const jsDocText = createJsDocText(comment.value, indentation)

        // note: Check if there's already a JSDoc comment above
        const commentsBefore = sourceCode.getCommentsBefore(node)
        const hasJsDocAbove = commentsBefore.some((c) => c.type === 'Block' && c.value.startsWith('*'))

        if (hasJsDocAbove) {
          // note: Just report without fix if there's already JSDoc
          context.report({
            loc: comment.loc,
            messageId: 'preferJsDocOverTrailing',
          })
          continue
        }

        // note: Find the start of the node (including any preceding tokens on the same line, if any)
        const fullText = sourceCode.getText()
        let nodeStart = node.range[0]

        // note: Handle potential preceding decorators or modifiers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodeWithDecorators = node as any
        if (nodeWithDecorators.decorators && nodeWithDecorators.decorators.length > 0) {
          nodeStart = nodeWithDecorators.decorators[0].range[0]
        }

        // note: Find the start of the line to insert JSDoc there
        let lineStart = nodeStart
        while (lineStart > 0 && fullText[lineStart - 1] !== '\n') {
          lineStart--
        }

        // note: Calculate the range to remove (the trailing comment and any preceding whitespace on same line)
        let commentStart = comment.range[0]
        // note: Include preceding whitespace/semicolons that separate the member from the comment
        while (commentStart > node.range[1] && (fullText[commentStart - 1] === ' ' || fullText[commentStart - 1] === '\t')) {
          commentStart--
        }

        context.report({
          loc: comment.loc,
          messageId: 'preferJsDocOverTrailing',
          fix(fixer) {
            return [
              // note: Insert JSDoc above the member (at the start of the line)
              fixer.insertTextBeforeRange([lineStart, lineStart], jsDocText),
              // note: Remove the trailing comment (and preceding whitespace)
              fixer.removeRange([commentStart, comment.range[1]]),
            ]
          },
        })
      }
    }
  },
})
