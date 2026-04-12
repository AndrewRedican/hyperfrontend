import type { Rule } from 'eslint'
import { basename, dirname } from 'node:path'
import { isPublishableLibrary } from '../utils/nx-project'
import { findWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the require-codeblock-language rule.
 */
export const RULE_NAME = 'require-codeblock-language'

/**
 * Represents a code block without a language identifier.
 */
export interface UnlabeledCodeBlock {
  /** Starting line number (1-based). */
  startLine: number
  /** Column offset of the opening backticks. */
  column: number
}

/**
 * Checks if a line starts a fenced code block (triple backticks).
 *
 * @param line - The line to check.
 * @returns True if the line starts a code block.
 */
export function isCodeBlockStart(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith('```')
}

/**
 * Checks if a code block opening has a language identifier.
 *
 * @param line - The line containing the code block opening.
 * @returns True if the code block has a language specified.
 */
export function hasLanguageIdentifier(line: string): boolean {
  const trimmed = line.trimStart()

  if (!trimmed.startsWith('```')) {
    return false
  }

  const afterBackticks = trimmed.slice(3).trim()

  if (afterBackticks.length === 0) {
    return false
  }

  return true
}

/**
 * Detects code blocks without language identifiers in markdown content.
 *
 * @param content - The markdown content to analyze.
 * @returns An array of detected unlabeled code blocks.
 */
export function detectUnlabeledCodeBlocks(content: string): UnlabeledCodeBlock[] {
  const lines = content.split('\n')
  const blocks: UnlabeledCodeBlock[] = []

  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = <string>lines[i]
    const trimmedLine = line.trimStart()

    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true

        if (!hasLanguageIdentifier(line)) {
          const column = line.indexOf('```')
          blocks.push({
            startLine: i + 1,
            column,
          })
        }
      } else {
        inCodeBlock = false
      }
    }
  }

  return blocks
}

/**
 * Checks if a file is at the workspace root level.
 *
 * @param filePath - The file path to check.
 * @returns True if the file is in the workspace root directory.
 */
export function isAtWorkspaceRoot(filePath: string): boolean {
  const workspaceRoot = findWorkspaceRoot(filePath)
  if (!workspaceRoot) {
    return false
  }

  const fileDir = dirname(filePath)
  return fileDir === workspaceRoot
}

/**
 * Checks if a file is within a publishable library.
 *
 * @param filePath - The file path to check.
 * @returns True if the file is in a publishable library.
 */
export function isInPublishableLibrary(filePath: string): boolean {
  const fileDir = dirname(filePath)
  return isPublishableLibrary(fileDir)
}

/**
 * Determines if the rule should apply to this file.
 * The rule applies to markdown files that are either:
 * - At the workspace root
 * - In a publishable library directory
 *
 * @param filePath - The file path to check.
 * @returns True if the rule should apply.
 */
export function shouldApplyRule(filePath: string): boolean {
  const fileName = basename(filePath)
  const fileExt = fileName.slice(fileName.lastIndexOf('.'))

  if (fileExt !== '.md') {
    return false
  }

  return isAtWorkspaceRoot(filePath) || isInPublishableLibrary(filePath)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require language identifiers on fenced code blocks in markdown files',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingLanguage:
        'Code block is missing a language identifier. Add a language (e.g., ```typescript, ```json, ```bash) after the opening backticks.',
    },
  },

  create(context) {
    const filePath = context.filename

    if (!shouldApplyRule(filePath)) {
      return {}
    }

    return {
      root(node: Rule.Node) {
        const sourceCode = context.sourceCode
        const content = sourceCode.getText()

        const unlabeledBlocks = detectUnlabeledCodeBlocks(content)

        for (const block of unlabeledBlocks) {
          context.report({
            node,
            loc: {
              start: { line: block.startLine, column: block.column },
              end: { line: block.startLine, column: block.column + 3 },
            },
            messageId: 'missingLanguage',
          })
        }
      },
    }
  },
}

export default rule
