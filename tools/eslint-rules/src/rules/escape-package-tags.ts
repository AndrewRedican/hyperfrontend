import { ESLintUtils } from '@typescript-eslint/utils'

/**
 * Rule identifier for the escape-package-tags rule.
 */
export const RULE_NAME = 'escape-package-tags'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the escape-package-tags rule.
 */
type MessageIds = 'unescapedPackageTag'

/**
 * Configuration options for the escape-package-tags rule.
 */
export interface RuleOptions {
  /**
   * Package scope prefixes that must never appear bare in a JSDoc description.
   *
   * @default ['@hyperfrontend']
   */
  prefixes?: readonly string[]
}

/**
 * Default package scope prefixes guarded by this rule.
 */
export const DEFAULT_PREFIXES = ['@hyperfrontend']

/**
 * A package reference found in a JSDoc description that is not wrapped in backticks.
 */
export interface BarePackageTag {
  /** Index where the replacement starts, covering a leading backslash escape when present. */
  start: number
  /** Index one past the last replaced character. */
  end: number
  /** The package specifier itself, without an escape character or surrounding backticks. */
  specifier: string
}

const ASTERISK = 42
const AT_SIGN = 64
const BACKSLASH = 92
const DOT = 46
const HYPHEN = 45
const SLASH = 47
const SPACE = 32
const TAB = 9
const UNDERSCORE = 95

/**
 * Checks whether a character code is an ASCII letter or digit.
 *
 * @param code - The character code to classify.
 * @returns True when the code is alphanumeric.
 */
function isAlphanumeric(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

/**
 * Checks whether a character code is a space or a tab.
 *
 * @param code - The character code to classify.
 * @returns True when the code is horizontal whitespace.
 */
function isSpace(code: number): boolean {
  return code === SPACE || code === TAB
}

/**
 * Checks whether a character code continues a bare word. A prefix followed by one of these is part of a
 * longer identifier rather than a package reference.
 *
 * @param code - The character code to classify.
 * @returns True when the code continues a word.
 */
function isWordChar(code: number): boolean {
  return isAlphanumeric(code) || code === HYPHEN || code === UNDERSCORE
}

/**
 * Checks whether a character code may appear inside the sub-path of a package specifier.
 *
 * @param code - The character code to classify.
 * @returns True when the code is legal inside a package sub-path.
 */
function isSpecifierChar(code: number): boolean {
  return isWordChar(code) || code === DOT || code === SLASH
}

/**
 * Finds the index at which a JSDoc line's text begins, skipping indentation and the leading asterisk.
 *
 * @param line - A single raw line taken from a block comment's value.
 * @returns The index of the first character of comment text.
 */
export function findContentStart(line: string): number {
  let index = 0

  while (index < line.length && isSpace(line.charCodeAt(index))) {
    index++
  }

  if (index < line.length && line.charCodeAt(index) === ASTERISK) {
    index++
    if (index < line.length && isSpace(line.charCodeAt(index))) {
      index++
    }
  }

  return index
}

/**
 * Measures how far a package specifier extends from a matched prefix, discarding trailing sentence
 * punctuation such as a full stop or a stray separator.
 *
 * @param line - The line containing the match.
 * @param start - Index of the `@` that begins the prefix.
 * @param prefix - The configured scope prefix that matched.
 * @returns The exclusive end index, or -1 when the prefix is only part of a longer word.
 */
export function measureSpecifier(line: string, start: number, prefix: string): number {
  const prefixEnd = start + prefix.length
  let end = prefixEnd

  if (end < line.length) {
    const next = line.charCodeAt(end)

    if (isWordChar(next)) {
      return -1
    }

    if (next === SLASH) {
      end++
      while (end < line.length && isSpecifierChar(line.charCodeAt(end))) {
        end++
      }
    }
  }

  while (end > prefixEnd && !isAlphanumeric(line.charCodeAt(end - 1))) {
    end--
  }

  return end
}

/**
 * Finds every bare package reference on a single line of JSDoc text. A reference counts as bare when it
 * begins the line's text or follows whitespace, optionally preceded by a backslash escape. References
 * already wrapped in backticks or embedded in quotes are left alone, matching `jsdoc/escape-inline-tags`.
 *
 * @param line - A single raw line taken from a block comment's value.
 * @param prefixes - The configured scope prefixes to look for.
 * @returns Every bare reference on the line, with indices relative to the line.
 */
export function findBareTagsOnLine(line: string, prefixes: readonly string[]): BarePackageTag[] {
  const contentStart = findContentStart(line)
  const found: BarePackageTag[] = []

  for (let index = contentStart; index < line.length; index++) {
    if (line.charCodeAt(index) !== AT_SIGN) {
      continue
    }

    const escaped = index > contentStart && line.charCodeAt(index - 1) === BACKSLASH
    const boundary = escaped ? index - 1 : index

    if (boundary !== contentStart && !isSpace(line.charCodeAt(boundary - 1))) {
      continue
    }

    for (const prefix of prefixes) {
      if (!line.startsWith(prefix, index)) {
        continue
      }

      const end = measureSpecifier(line, index, prefix)

      if (end === -1) {
        continue
      }

      found.push({ start: boundary, end, specifier: line.slice(index, end) })
      index = end - 1
      break
    }
  }

  return found
}

/**
 * Determines whether a line's text opens or closes a fenced code block.
 *
 * @param content - The line's text, with indentation and the leading asterisk removed.
 * @returns True when the line is a code fence.
 */
function isCodeFence(content: string): boolean {
  return content.startsWith('```')
}

/**
 * Collects bare package references from the description of a JSDoc comment. Scanning stops at the first
 * genuine block tag, mirroring `jsdoc/escape-inline-tags`, except that a line opening with a guarded
 * prefix is reported rather than treated as a tag: that is exactly the corruption this rule prevents.
 *
 * @param commentValue - The raw value of a block comment, excluding its delimiters.
 * @param prefixes - The configured scope prefixes to look for.
 * @returns Every bare reference, with indices relative to the comment value.
 */
export function findBarePackageTags(commentValue: string, prefixes: readonly string[]): BarePackageTag[] {
  const results: BarePackageTag[] = []
  const lines = commentValue.split('\n')

  let offset = 0
  let insideFence = false

  for (const line of lines) {
    const content = line.slice(findContentStart(line))

    if (isCodeFence(content)) {
      insideFence = !insideFence
      offset += line.length + 1
      continue
    }

    if (!insideFence) {
      const opensTag = content.charCodeAt(0) === AT_SIGN
      const opensGuardedTag = opensTag && prefixes.some((prefix) => content.startsWith(prefix))

      if (opensTag && !opensGuardedTag) {
        break
      }

      for (const tag of findBareTagsOnLine(line, prefixes)) {
        results.push({ start: tag.start + offset, end: tag.end + offset, specifier: tag.specifier })
      }
    }

    offset += line.length + 1
  }

  return results
}

export default createRule<[RuleOptions?], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Require workspace package references in JSDoc descriptions to be wrapped in backticks',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          prefixes: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Package scope prefixes that must never appear bare in a JSDoc description.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unescapedPackageTag:
        'Wrap `{{ specifier }}` in backticks. Left bare it is parsed as a JSDoc tag, and a backslash escape leaks into the rendered docs.',
    },
  },
  defaultOptions: [{ prefixes: DEFAULT_PREFIXES }],
  create(context, [options]) {
    /* istanbul ignore next - defaultOptions always supplies prefixes, so the fallback is unreachable */
    const prefixes = options?.prefixes ?? DEFAULT_PREFIXES
    const sourceCode = context.sourceCode

    return {
      'Program:exit'() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
            continue
          }

          const valueStart = comment.range[0] + 2

          for (const tag of findBarePackageTags(comment.value, prefixes)) {
            const start = valueStart + tag.start
            const end = valueStart + tag.end

            context.report({
              loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) },
              messageId: 'unescapedPackageTag',
              data: { specifier: tag.specifier },
              fix: (fixer) => fixer.replaceTextRange([start, end], `\`${tag.specifier}\``),
            })
          }
        }
      },
    }
  },
})
