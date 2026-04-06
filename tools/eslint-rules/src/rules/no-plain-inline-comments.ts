import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { hasAllowedHintPrefix, isConfigFile, isToolingDirective } from '../utils/comment-analysis'

/**
 * Rule identifier for the no-plain-inline-comments rule.
 */
export const RULE_NAME = 'no-plain-inline-comments'

/**
 * Determine if a comment is inside an empty block (e.g., empty catch clause or function body) where comments are often used for explanations or placeholders.
 *
 * @param comment - The comment node to check.
 * @param emptyBlocks - A set of empty block statements collected during traversal.
 * @returns True if the comment is inside any of the empty blocks, false otherwise.
 */
function isInsideEmptyBlock(comment: TSESTree.Comment, emptyBlocks: Set<TSESTree.BlockStatement>): boolean {
  for (const block of emptyBlocks) {
    const [blockStart, blockEnd] = block.range
    const [commentStart, commentEnd] = comment.range
    if (commentStart >= blockStart && commentEnd <= blockEnd) {
      return true
    }
  }
  return false
}

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'noPlainInlineComments'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow plain inline comments unless they use allowed hint prefixes or are tooling directives.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noPlainInlineComments:
        'Plain inline comments are not allowed. Use an allowed hint prefix (why:, how:, context:, magic:, todo:, fixme:, note:, ref:) or a tooling directive.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    const filePath = context.filename ?? context.getFilename()

    // note: Skip config files
    if (isConfigFile(filePath)) return {}

    // note: Collect empty blocks (catch clauses and function bodies with no statements)
    const emptyBlocks = createSet<TSESTree.BlockStatement>()

    return {
      // note: Collect empty catch blocks
      CatchClause(node: TSESTree.CatchClause) {
        if (node.body.body.length === 0) {
          emptyBlocks.add(node.body)
        }
      },

      // note: Collect empty function bodies
      FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
        if (node.body.body.length === 0) {
          emptyBlocks.add(node.body)
        }
      },

      FunctionExpression(node: TSESTree.FunctionExpression) {
        if (node.body.body.length === 0) {
          emptyBlocks.add(node.body)
        }
      },

      ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
        if (node.body.type === 'BlockStatement' && node.body.body.length === 0) {
          emptyBlocks.add(node.body)
        }
      },

      'Program:exit'() {
        const comments = sourceCode.getAllComments()

        for (const comment of comments) {
          // note: Only check line comments (// comments)
          if (comment.type !== 'Line') continue
          const content = comment.value
          if (isToolingDirective(content)) continue
          if (hasAllowedHintPrefix(content)) continue
          if (isInsideEmptyBlock(comment, emptyBlocks)) continue

          // note: Find the full range to delete (including leading whitespace if trailing, or full line if standalone)
          const fullText = sourceCode.getText()
          const line = comment.loc.start.line
          const lineStart = sourceCode.getIndexFromLoc({ line, column: 0 })

          // note: Check if this is a trailing comment (code before comment on same line)
          const textBeforeOnLine = sourceCode.getLines()[line - 1]?.slice(0, comment.loc.start.column) || ''
          const hasCodeBefore = textBeforeOnLine.trim().length > 0

          let start: number
          let end: number

          if (hasCodeBefore) {
            // note: Trailing comment - remove from before the comment to end of comment
            // note: Find whitespace before the comment
            let wsStart = comment.range[0]
            while (wsStart > lineStart && /\s/.test(<string>fullText[wsStart - 1])) {
              wsStart--
            }
            start = wsStart
            end = comment.range[1]
          } else {
            // note: Standalone comment - remove the entire line including newline
            start = lineStart
            end = comment.range[1]
            // note: Include trailing newline if present
            if (fullText[end] === '\n') {
              end++
            } else if (fullText[end] === '\r' && fullText[end + 1] === '\n') {
              end += 2
            }
          }

          context.report({
            loc: comment.loc,
            messageId: 'noPlainInlineComments',
            fix(fixer) {
              return fixer.removeRange([start, end])
            },
          })
        }
      },
    }
  },
})
