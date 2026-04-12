import type { Rule } from 'eslint'
import { basename } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the no-ascii-art-diagrams rule.
 */
export const RULE_NAME = 'no-ascii-art-diagrams'

/**
 * Box-drawing characters commonly used in ASCII art diagrams.
 * Includes corners, lines, and connectors.
 */
const BOX_DRAWING_CHARS = createSet([
  '┌',
  '┐',
  '└',
  '┘',
  '│',
  '─',
  '├',
  '┤',
  '┬',
  '┴',
  '┼',
  '╔',
  '╗',
  '╚',
  '╝',
  '║',
  '═',
  '╠',
  '╣',
  '╦',
  '╩',
  '╬',
  '+',
  '|',
])

/**
 * Right-side box characters that indicate actual box diagrams (not directory trees).
 * Directory trees only use left-side chars (├, └, │) while box diagrams have right-side elements.
 */
const RIGHT_SIDE_BOX_CHARS = createSet(['┐', '┘', '┤', '╗', '╝', '╣'])

/**
 * Top-left corner characters that indicate start of a box.
 */
const TOP_LEFT_CORNER_CHARS = createSet(['┌', '╔'])

/**
 * Horizontal border characters.
 */
const HORIZONTAL_BORDER_CHARS = createSet(['─', '═', '┬', '┴', '╦', '╩', '┼', '╬'])

/**
 * Vertical border characters.
 */
const VERTICAL_BORDER_CHARS = createSet(['│', '║', '├', '┤', '╠', '╣', '┼', '╬'])

/**
 * Minimum consecutive lines with box-drawing to consider an ASCII art diagram.
 */
const MIN_DIAGRAM_LINES = 3

/**
 * Minimum box-drawing characters per line to consider it part of a diagram.
 * Set to 2 to catch lines like "│ text │" which have vertical bars on both sides.
 */
const MIN_CHARS_PER_LINE = 2

/**
 * Represents a detected ASCII art diagram block.
 */
export interface AsciiArtBlock {
  /** Starting line number (1-based). */
  startLine: number
  /** Ending line number (1-based). */
  endLine: number
  /** Lines containing the ASCII art. */
  lines: string[]
}

/**
 * Counts box-drawing characters in a line.
 *
 * @param line - The line to analyze.
 * @returns The count of box-drawing characters.
 */
export function countBoxDrawingChars(line: string): number {
  let count = 0
  for (const char of line) {
    if (BOX_DRAWING_CHARS.has(char)) {
      count++
    }
  }
  return count
}

/**
 * Checks if a line contains right-side box characters.
 * Right-side chars (┐, ┘, ┤) distinguish box diagrams from directory trees.
 *
 * @param line - The line to analyze.
 * @returns True if the line contains right-side box characters.
 */
export function hasRightSideBoxChars(line: string): boolean {
  for (const char of line) {
    if (RIGHT_SIDE_BOX_CHARS.has(char)) {
      return true
    }
  }
  return false
}

/**
 * Checks if a line contains top-left corner characters.
 *
 * @param line - The line to analyze.
 * @returns True if the line contains top-left corner characters.
 */
export function hasTopLeftCorner(line: string): boolean {
  for (const char of line) {
    if (TOP_LEFT_CORNER_CHARS.has(char)) {
      return true
    }
  }
  return false
}

/**
 * Checks if a line appears to be part of an ASCII art box diagram.
 * A line is considered part of a box if it has:
 * - Multiple box-drawing characters AND
 * - Either horizontal or vertical border patterns
 *
 * @param line - The line to analyze.
 * @returns True if the line appears to be part of an ASCII art diagram.
 */
export function isBoxDiagramLine(line: string): boolean {
  const boxCharCount = countBoxDrawingChars(line)

  if (boxCharCount < MIN_CHARS_PER_LINE) {
    return false
  }

  let hasHorizontalBorder = false
  let hasVerticalBorder = false

  for (const char of line) {
    if (HORIZONTAL_BORDER_CHARS.has(char)) {
      hasHorizontalBorder = true
    }
    if (VERTICAL_BORDER_CHARS.has(char)) {
      hasVerticalBorder = true
    }
  }

  return hasHorizontalBorder || hasVerticalBorder || hasRightSideBoxChars(line) || hasTopLeftCorner(line)
}

/**
 * Checks if a block of lines forms an ASCII art box structure.
 * A valid box structure should have right-side box characters (┐, ┘, ┤)
 * which distinguish it from directory trees that only use left-side chars.
 *
 * @param lines - The lines to analyze.
 * @returns True if the lines form a box structure.
 */
export function isBoxStructure(lines: string[]): boolean {
  let hasRightSideChars = false
  let hasTopLeftCornerChar = false
  let verticalBorderLines = 0

  for (const line of lines) {
    if (hasRightSideBoxChars(line)) {
      hasRightSideChars = true
    }
    if (hasTopLeftCorner(line)) {
      hasTopLeftCornerChar = true
    }

    for (const char of line) {
      if (VERTICAL_BORDER_CHARS.has(char)) {
        verticalBorderLines++
        break
      }
    }
  }

  return hasRightSideChars && hasTopLeftCornerChar && verticalBorderLines >= 2
}

/**
 * Detects ASCII art diagram blocks in markdown content.
 * Only detects diagrams inside code blocks (which is where they typically appear).
 *
 * @param content - The markdown content to analyze.
 * @returns An array of detected ASCII art blocks.
 */
export function detectAsciiArtDiagrams(content: string): AsciiArtBlock[] {
  const lines = content.split('\n')
  const blocks: AsciiArtBlock[] = []

  let inCodeBlock = false
  let codeBlockStart = -1
  let codeBlockLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = <string>lines[i]
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockStart = i + 1
        codeBlockLines = []
      } else {
        if (codeBlockLines.length >= MIN_DIAGRAM_LINES) {
          const diagramLines = codeBlockLines.filter(isBoxDiagramLine)

          if (diagramLines.length >= MIN_DIAGRAM_LINES && isBoxStructure(diagramLines)) {
            blocks.push({
              startLine: codeBlockStart + 1,
              endLine: i + 1,
              lines: codeBlockLines,
            })
          }
        }

        inCodeBlock = false
        codeBlockStart = -1
        codeBlockLines = []
      }
    } else if (inCodeBlock) {
      codeBlockLines.push(line)
    }
  }

  return blocks
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow ASCII art diagrams in markdown files; prefer Mermaid diagrams',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/no-ascii-art-diagrams.md',
    },
    schema: [],
    messages: {
      noAsciiArtInReadme:
        'ASCII art diagrams are not allowed in README.md. npm does not render Mermaid diagrams, so link to ARCHITECTURE.md or other documentation files instead.',
      noAsciiArtInDocs:
        'ASCII art diagrams are not allowed. Use Mermaid diagrams instead for better rendering, accessibility, and maintainability.',
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = basename(filePath)
    const fileExt = fileName.slice(fileName.lastIndexOf('.'))

    if (fileExt !== '.md') {
      return {}
    }

    const isReadme = fileName === 'README.md'

    return {
      root(node: Rule.Node) {
        const sourceCode = context.sourceCode
        const content = sourceCode.getText()

        const asciiArtBlocks = detectAsciiArtDiagrams(content)

        for (const block of asciiArtBlocks) {
          context.report({
            node,
            loc: {
              start: { line: block.startLine, column: 0 },
              end: { line: block.endLine, column: 0 },
            },
            messageId: isReadme ? 'noAsciiArtInReadme' : 'noAsciiArtInDocs',
          })
        }
      },
    }
  },
}

export default rule
