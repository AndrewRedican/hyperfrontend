import { ESLintUtils } from '@typescript-eslint/utils'
import { isDecorativeHeaderComment } from '../utils/comment-analysis'

/**
 * Rule identifier for the no-decorative-header-comments rule.
 */
export const RULE_NAME = 'no-decorative-header-comments'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the no-decorative-header-comments rule.
 */
type MessageIds = 'noDecorativeHeaderComments'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow decorative file header block comments that lack meaningful JSDoc tags.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noDecorativeHeaderComments:
        'Decorative file header comments are not allowed. Either add meaningful JSDoc tags (@module, @param, etc.) or remove the comment.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()

    return {
      Program() {
        const comments = sourceCode.getAllComments()

        // note: only check block comments at the very start of the file
        for (const comment of comments) {
          if (!isDecorativeHeaderComment(comment, sourceCode)) continue

          // note: find the full range to delete (including trailing whitespace/newlines)
          const fullText = sourceCode.getText()
          let end = comment.range[1]

          // note: skip all whitespace and newlines after the comment to clean up formatting
          while (end < fullText.length && /\s/.test(fullText[end] as string)) {
            end++
          }

          context.report({
            loc: comment.loc,
            messageId: 'noDecorativeHeaderComments',
            fix(fixer) {
              return fixer.removeRange([comment.range[0], end])
            },
          })

          // note: only check the first block comment that qualifies
          break
        }
      },
    }
  },
})
