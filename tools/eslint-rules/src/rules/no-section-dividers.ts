import { ESLintUtils } from '@typescript-eslint/utils'
import { findSectionDividerBlocks } from '../utils/comment-analysis'

/**
 * Rule identifier for the no-section-dividers rule.
 */
export const RULE_NAME = 'no-section-dividers'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/** Message identifiers for rule violations. */
type MessageIds = 'noSectionDividers'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow artificial section divider comments (comments with 4+ consecutive equals signs).',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noSectionDividers:
        'Section divider comments are not allowed. Use meaningful code organization (separate files, classes, or functions) instead of visual separators.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()

    return {
      Program() {
        const comments = sourceCode.getAllComments()
        const dividerBlocks = findSectionDividerBlocks(comments, sourceCode)

        // note: Process blocks from bottom to top to avoid offset issues during fixing
        const sortedBlocks = [...dividerBlocks].sort((a, b) => b.start - a.start)

        for (const block of sortedBlocks) {
          const firstComment = block.comments[0]
          const lastComment = block.comments[block.comments.length - 1]

          /* istanbul ignore next - defensive check */
          if (!firstComment || !lastComment) continue

          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(block.start),
              end: sourceCode.getLocFromIndex(block.end),
            },
            messageId: 'noSectionDividers',
            fix(fixer) {
              return fixer.removeRange([block.start, block.end])
            },
          })
        }
      },
    }
  },
})
