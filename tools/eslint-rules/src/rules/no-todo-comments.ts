import { ESLintUtils } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-todo-comments rule.
 */
export const RULE_NAME = 'no-todo-comments'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'noTodoComment'

/**
 * Lowercase patterns for task-reminder markers detected in comments.
 */
const TODO_PATTERNS = ['todo', 'to-do', 'to do']

/**
 * Checks if a character is a word character (letter, digit, or underscore).
 *
 * @param ch - The character to check.
 * @returns True if it is a word character.
 */
function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) return false
  const code = ch.charCodeAt(0)
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95
}

/**
 * Finds all standalone task-reminder marker occurrences in text (case-insensitive, no regex).
 *
 * A match is standalone if not preceded or followed by a word character or hyphen,
 * which prevents false positives like "path-to-document" or "auto download".
 *
 * @param text - The text to search.
 * @returns Array of index and length for each match.
 */
function findTodoOccurrences(text: string): Array<{ index: number; length: number }> {
  const lower = text.toLowerCase()
  const results: Array<{ index: number; length: number }> = []

  for (const pattern of TODO_PATTERNS) {
    let searchStart = 0
    while (searchStart < lower.length) {
      const index = lower.indexOf(pattern, searchStart)
      if (index === -1) break

      const before = index > 0 ? text[index - 1] : undefined
      const after = text[index + pattern.length]

      const beforeIsWordOrHyphen = isWordChar(before) || before === '-'
      const afterIsWordOrHyphen = isWordChar(after) || after === '-'

      if (!beforeIsWordOrHyphen && !afterIsWordOrHyphen) {
        results.push({ index, length: pattern.length })
      }

      searchStart = index + 1
    }
  }

  return results
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow TODO comments and their common permutations (todo, to-do, to do) in all comment types.',
    },
    schema: [],
    messages: {
      noTodoComment:
        'TODO comments are not allowed. Address the issue or create a tracking ticket instead of leaving TODO markers in the code.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()

    return {
      Program() {
        const comments = sourceCode.getAllComments()

        for (const comment of comments) {
          const matches = findTodoOccurrences(comment.value)
          if (matches.length === 0) continue

          // +2 for the comment opener (// or /*)
          const commentValueStart = comment.range[0] + 2

          for (const match of matches) {
            const matchStart = commentValueStart + match.index
            const matchEnd = matchStart + match.length

            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(matchStart),
                end: sourceCode.getLocFromIndex(matchEnd),
              },
              messageId: 'noTodoComment',
            })
          }
        }
      },
    }
  },
})
