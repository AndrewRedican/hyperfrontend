import type { TSESTree } from '@typescript-eslint/utils'
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint'

/**
 * Common JSDoc tags that indicate legitimate documentation rather than decorative comments.
 */
export const JSDOC_TAGS = [
  '@module',
  '@namespace',
  '@class',
  '@interface',
  '@typedef',
  '@callback',
  '@param',
  '@returns',
  '@return',
  '@throws',
  '@example',
  '@see',
  '@since',
  '@version',
  '@author',
  '@license',
  '@copyright',
  '@type',
  '@property',
  '@prop',
  '@template',
  '@generic',
  '@public',
  '@private',
  '@protected',
  '@internal',
  '@readonly',
  '@override',
  '@abstract',
  '@virtual',
  '@implements',
  '@extends',
  '@augments',
  '@inheritdoc',
  '@default',
  '@defaultValue',
  '@enum',
  '@const',
  '@constant',
  '@function',
  '@func',
  '@method',
  '@member',
  '@var',
  '@let',
  '@async',
  '@generator',
  '@yields',
  '@yield',
  '@fires',
  '@emits',
  '@listens',
  '@event',
  '@borrows',
  '@lends',
  '@mixes',
  '@mixin',
  '@constructs',
  '@requires',
  '@satisfies',
  '@vitest-environment',
  '@jsxImportSource',
  '@jsxFrag',
  '@jsx',
  '@locked',
]

/**
 * Tooling directive patterns that are always allowed in comments.
 * These are used by build tools, linters, coverage tools, etc.
 */
export const TOOLING_DIRECTIVE_PATTERNS = [
  '@ts-ignore',
  '@ts-expect-error',
  '@ts-nocheck',
  '@ts-check',
  'eslint-disable',
  'eslint-enable',
  'eslint-disable-line',
  'eslint-disable-next-line',
  'eslint-env',
  'istanbul ignore',
  'istanbul ignore next',
  'istanbul ignore line',
  'c8 ignore',
  'c8 ignore next',
  'c8 ignore start',
  'c8 ignore stop',
  'webpackChunkName',
  'webpackMode',
  'webpackPrefetch',
  'webpackPreload',
  'webpackInclude',
  'webpackExclude',
  'vite-ignore',
  'prettier-ignore',
  '@vite-ignore',
  '@rollup-plugin-ignore',
  'sourceMappingURL',
  'sourceURL',
  'falls through',
  'fall through',
  'no default',
  'intentional fallthrough',
  'fallthrough',
]

/**
 * Allowed hint prefixes for inline comments (case-insensitive).
 * The prefix must be followed by a colon.
 */
export const ALLOWED_HINT_PREFIXES = ['why', 'how', 'context', 'magic', 'todo', 'fixme', 'note', 'ref']

/**
 * Checks if comment content contains a valid JSDoc tag.
 *
 * @param content - The comment content (without delimiters).
 * @returns True if a JSDoc tag is found.
 */
export function containsJsDocTag(content: string): boolean {
  const lower = content.toLowerCase()
  for (const tag of JSDOC_TAGS) {
    const tagLower = tag.toLowerCase()
    const index = lower.indexOf(tagLower)
    if (index !== -1) {
      // note: Check it's a complete tag (followed by whitespace, *, newline, or end)
      const charAfter = content[index + tag.length]
      if (
        charAfter === undefined ||
        charAfter === ' ' ||
        charAfter === '\t' ||
        charAfter === '\n' ||
        charAfter === '\r' ||
        charAfter === '*'
      ) {
        return true
      }
    }
  }
  return false
}

/**
 * Checks if comment content is a tooling directive.
 *
 * @param content - The comment content (without delimiters).
 * @returns True if it's a tooling directive.
 */
export function isToolingDirective(content: string): boolean {
  const trimmed = content.trim().toLowerCase()
  for (const directive of TOOLING_DIRECTIVE_PATTERNS) {
    if (trimmed.startsWith(directive.toLowerCase())) {
      return true
    }
  }
  return false
}

/**
 * Checks if an inline comment starts with an allowed hint prefix.
 *
 * @param content - The comment content (without // delimiter).
 * @returns True if it starts with an allowed prefix followed by colon.
 */
export function hasAllowedHintPrefix(content: string): boolean {
  const trimmed = content.trim().toLowerCase()
  for (const prefix of ALLOWED_HINT_PREFIXES) {
    if (trimmed.startsWith(prefix + ':')) {
      return true
    }
  }
  return false
}

/**
 * Checks if a string contains a section divider pattern (4+ equals signs).
 *
 * @param content - The string to check.
 * @returns True if a divider pattern is found.
 */
export function containsSectionDivider(content: string): boolean {
  // note: Look for 4 or more consecutive equals signs
  let count = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '=') {
      count++
      if (count >= 4) return true
    } else {
      count = 0
    }
  }
  return false
}

/**
 * Checks if a block comment at the top of a file is decorative (not legitimate JSDoc).
 *
 * @param comment - The comment node.
 * @param sourceCode - The source code object.
 * @returns True if it's a decorative header comment.
 */
export function isDecorativeHeaderComment(comment: TSESTree.Comment, sourceCode: SourceCode): boolean {
  // note: Must be a block comment
  if (comment.type !== 'Block') return false

  // note: Check if it's at the very start of the file (allowing only whitespace before)
  const textBefore = sourceCode.getText().slice(0, comment.range[0])
  if (textBefore.trim().length > 0) return false

  // note: If it contains JSDoc tags or tooling directives, it's not decorative
  if (containsJsDocTag(comment.value)) return false
  if (isToolingDirective(comment.value)) return false

  // note: Check if comment immediately precedes a declaration (no blank line between)
  // note: If there's no blank line, this is JSDoc for that code, not a decorative header
  const fullText = sourceCode.getText()
  const textAfter = fullText.slice(comment.range[1])

  // note: Find the first non-whitespace content after the comment
  const match = textAfter.match(/^(\s*)([^\s])/)
  if (match) {
    const whitespace = match[1]
    // note: Check if there's a blank line (two or more newlines) between comment and code
    const newlineCount = (whitespace.match(/\n/g) || []).length
    const hasBlankLine = newlineCount >= 2

    // note: If no blank line, check if it starts with a declaration
    if (!hasBlankLine) {
      const contentAfter = textAfter.trimStart()
      const declarationPatterns = [
        'export ',
        'import ',
        'interface ',
        'type ',
        'class ',
        'function ',
        'const ',
        'let ',
        'var ',
        'async ',
        'abstract ',
        'enum ',
        'namespace ',
        'module ',
        'declare ',
      ]
      const startsWithDeclaration = declarationPatterns.some((pattern) => contentAfter.startsWith(pattern))
      if (startsWithDeclaration) return false
    }
  }

  // note: Check if it looks like a header comment (typically multi-line with prose)
  const lines = comment.value.split('\n')
  if (lines.length < 2) return false

  // note: A decorative header typically has prose content without meaningful tags
  // note: Check if it's just descriptive text with asterisks
  const hasOnlyProseContent = lines.every((line) => {
    const trimmed = line.trim().replace(/^\*+/, '').trim()
    // note: Empty lines, or lines with just text (no @tags)
    return trimmed.length === 0 || !trimmed.startsWith('@')
  })

  return hasOnlyProseContent
}

/**
 * Gets the text content of a line comment (without the // prefix).
 *
 * @param comment - The comment which should be a line comment.
 * @returns The content of the line comment, or empty string if not a line comment.
 */
export function getLineCommentContent(comment: TSESTree.Comment): string {
  if (comment.type !== 'Line') return ''
  return comment.value
}

/**
 * Checks if a comment is on the same line as code (trailing comment).
 *
 * @param comment - The comment node.
 * @param sourceCode - The source code object.
 * @returns True if it's a trailing comment.
 */
export function isTrailingComment(comment: TSESTree.Comment, sourceCode: SourceCode): boolean {
  const line = comment.loc.start.line
  const textBeforeOnLine = sourceCode.getLines()[line - 1]?.slice(0, comment.loc.start.column) || ''
  // note: If there's non-whitespace before the comment on the same line, it's trailing
  return textBeforeOnLine.trim().length > 0
}

/**
 * Information about a contiguous block of section divider comments.
 */
export interface SectionDividerBlock {
  /** All comments in the block. */
  comments: TSESTree.Comment[]
  /** Start position of the block. */
  start: number
  /** End position of the block. */
  end: number
}

/**
 * Finds contiguous blocks of line comments that form section dividers.
 * A section divider block contains at least one line with 4+ equals signs
 * and may include adjacent comment lines that are part of the visual separator.
 *
 * @param comments - All comments in the file.
 * @param sourceCode - The source code object.
 * @returns Array of section divider blocks.
 */
export function findSectionDividerBlocks(comments: TSESTree.Comment[], sourceCode: SourceCode): SectionDividerBlock[] {
  const blocks: SectionDividerBlock[] = []
  const lineComments = comments.filter((c) => c.type === 'Line')

  // note: Group consecutive line comments on adjacent lines
  const groups: TSESTree.Comment[][] = []
  let currentGroup: TSESTree.Comment[] = []

  for (const comment of lineComments) {
    if (currentGroup.length === 0) {
      currentGroup.push(comment)
    } else {
      const lastComment = currentGroup[currentGroup.length - 1]
      // note: Check if on adjacent lines and same column (same indentation)
      if (
        lastComment &&
        comment.loc.start.line === lastComment.loc.end.line + 1 &&
        comment.loc.start.column === lastComment.loc.start.column
      ) {
        currentGroup.push(comment)
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup)
        }
        currentGroup = [comment]
      }
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  // note: Check each group for section dividers
  for (const group of groups) {
    const hasDivider = group.some((c) => containsSectionDivider(c.value))
    if (hasDivider) {
      // note: Include the entire contiguous block if it contains a divider
      const firstComment = group[0]
      const lastComment = group[group.length - 1]

      if (firstComment && lastComment) {
        const fullText = sourceCode.getText()

        // note: Find the start of the line for the first comment (but do NOT include preceding newline)
        let lineStart = firstComment.range[0]
        while (lineStart > 0 && fullText[lineStart - 1] !== '\n') {
          lineStart--
        }

        // note: Find end of last comment line (including newline)
        let end = lastComment.range[1]
        while (end < fullText.length && fullText[end] !== '\n') {
          end++
        }
        // note: Include the newline if present
        if (end < fullText.length && fullText[end] === '\n') {
          end++
        }

        blocks.push({
          comments: group,
          start: lineStart,
          end,
        })
      }
    }
  }

  return blocks
}

/**
 * Checks if a file path is a configuration file that should be excluded from plain comment checks.
 *
 * @param filePath - The file path to check.
 * @returns True if it's a configuration file.
 */
export function isConfigFile(filePath: string): boolean {
  const configPatterns = [
    'tsconfig',
    'jest.config',
    'eslint.config',
    'eslint.base.config',
    '.eslintrc',
    'vite.config',
    'webpack.config',
    'rollup.config',
    'babel.config',
    '.babelrc',
    'prettier.config',
    '.prettierrc',
    'postcss.config',
    'tailwind.config',
    'next.config',
    'nuxt.config',
    'svelte.config',
    'angular.json',
    'nx.json',
    'project.json',
    'package.json',
    'vitest.config',
    'playwright.config',
    'cypress.config',
    'commitlint.config',
    'lint-staged.config',
    'lefthook',
  ]

  const fileName = filePath.split('/').pop()?.toLowerCase() || ''

  for (const pattern of configPatterns) {
    if (fileName.includes(pattern.toLowerCase())) {
      return true
    }
  }

  return false
}
