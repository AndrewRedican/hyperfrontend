import { ESLintUtils } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-deprecated-tag rule.
 */
export const RULE_NAME = 'no-deprecated-tag'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'noDeprecatedTag'

/**
 * The deprecated tag to detect in JSDoc comments.
 */
const DEPRECATED_TAG = '@deprecated'

/**
 * Characters that can follow a valid tag (whitespace or end of string).
 */
const TAG_TERMINATORS = new Set([' ', '\t', '\n', '\r', '*', undefined])

/**
 * Finds the index of the deprecated tag in a comment, case-insensitive.
 *
 * @param comment - The comment text to search.
 * @returns The index of the tag, or -1 if not found.
 */
function findDeprecatedTagIndex(comment: string): number {
  const lowerComment = comment.toLowerCase()
  let searchStart = 0

  while (searchStart < lowerComment.length) {
    const index = lowerComment.indexOf(DEPRECATED_TAG, searchStart)
    if (index === -1) return -1

    // Check that this is a complete tag (followed by whitespace, *, or end)
    const charAfter = comment[index + DEPRECATED_TAG.length]
    if (TAG_TERMINATORS.has(charAfter)) {
      return index
    }

    searchStart = index + 1
  }

  return -1
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow the deprecated JSDoc tag. Breaking changes are handled through semantic versioning.',
    },
    schema: [],
    messages: {
      noDeprecatedTag:
        'The deprecated tag is not allowed. This project handles breaking changes through semantic versioning and does not support backwards compatibility. Remove deprecated code in the next major version instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()

    return {
      Program() {
        const comments = sourceCode.getAllComments()

        for (const comment of comments) {
          if (comment.type !== 'Block') continue

          const tagIndex = findDeprecatedTagIndex(comment.value)
          if (tagIndex === -1) continue

          // Calculate precise location: +2 for /*, then tagIndex for position in comment
          const tagStart = comment.range[0] + 2 + tagIndex
          const tagEnd = tagStart + DEPRECATED_TAG.length

          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(tagStart),
              end: sourceCode.getLocFromIndex(tagEnd),
            },
            messageId: 'noDeprecatedTag',
          })
        }
      },
    }
  },
})
