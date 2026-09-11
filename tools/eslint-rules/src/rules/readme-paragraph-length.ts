import type { Rule } from 'eslint'
import { dirname } from 'node:path'
import { isPublishableLibraryDir } from '../utils/nx-project'
import { findProjectRoot, findWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the readme-paragraph-length rule.
 */
export const RULE_NAME = 'readme-paragraph-length'

/**
 * Rendered characters a paragraph may reach before the rule reports it.
 *
 * The documentation site sets its prose measure at 58rem, which is roughly 115 rendered
 * characters per line at 16px, so 700 characters is about six full lines. Across the
 * library READMEs the 95th percentile paragraph is 642 characters, so this sits above
 * ordinary technical writing and only catches the walls of text.
 */
export const DEFAULT_MAX_CHARACTERS = 700

/**
 * Node types whose `value` is the prose a reader actually reads.
 */
export const VALUE_NODE_TYPES = ['text', 'inlineCode'] as const

/**
 * Node types that occupy no reading width.
 *
 * An image is not read word by word, inline HTML is markup rather than prose, and a hard
 * break is a line ending.
 */
export const ZERO_WIDTH_NODE_TYPES = ['image', 'imageReference', 'html', 'break'] as const

/**
 * Container node types whose paragraphs are exempt.
 *
 * A list item, a quotation, a table cell and a footnote are all read as fragments rather
 * than as body prose, and their length is governed by the structure around them.
 */
export const SKIPPED_CONTAINER_TYPES = ['listItem', 'blockquote', 'tableCell', 'footnoteDefinition'] as const

/**
 * Options accepted by the rule.
 */
export interface ReadmeParagraphLengthOptions {
  /** Rendered characters a paragraph may reach before it is reported. */
  maxCharacters?: number
}

/**
 * A single point in a markdown source file, as mdast records it.
 */
export interface MarkdownPoint {
  /** Line number, 1-based. */
  line: number
  /** Column number, 1-based. */
  column: number
}

/**
 * The source range an mdast node covers.
 */
export interface MarkdownPosition {
  /** Where the node begins. */
  start: MarkdownPoint
  /** Where the node ends. */
  end: MarkdownPoint
}

/**
 * The parts of an mdast node this rule reads.
 */
export interface MarkdownNode {
  /** The mdast node type, for example `paragraph`, `text` or `listItem`. */
  type: string
  /** Literal content, present on `text`, `inlineCode` and `html` nodes. */
  value?: string
  /** Child nodes, present on every parent node. */
  children?: MarkdownNode[]
  /** Source range, absent only on synthesised nodes. */
  position?: MarkdownPosition
}

/**
 * The one `SourceCode` method this rule needs from the markdown language.
 */
export interface MarkdownAncestryReader {
  /**
   * Returns the ancestors of a node, outermost first.
   *
   * @param node - The node to read the ancestry of.
   * @returns The ancestor chain, starting at the document root.
   */
  getAncestors?: (node: MarkdownNode) => MarkdownNode[]
}

/**
 * Renders a paragraph subtree down to the prose a reader parses.
 *
 * Link targets are dropped and only the link text survives, because a long URL is not
 * something a reader works through word by word and must not push a paragraph over the
 * line. Images and inline HTML drop out for the same reason.
 *
 * @param node - The node to render.
 * @returns The rendered text of the node and everything below it.
 */
export function renderProse(node: MarkdownNode): string {
  if (VALUE_NODE_TYPES.some((type) => type === node.type)) {
    return node.value ?? ''
  }

  if (ZERO_WIDTH_NODE_TYPES.some((type) => type === node.type)) {
    return ''
  }

  const children = node.children

  if (!children) {
    return ''
  }

  return children.map(renderProse).join('')
}

/**
 * Collapses every run of whitespace to a single space and trims the ends.
 *
 * A paragraph wrapped over six source lines and the same paragraph written on one line
 * have to measure the same, so the source's own line breaks cannot count.
 *
 * @param text - The rendered text to normalise.
 * @returns The text with whitespace runs collapsed.
 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Measures how many rendered characters a paragraph carries.
 *
 * @param node - The paragraph node to measure.
 * @returns The rendered character count.
 */
export function measureParagraph(node: MarkdownNode): number {
  return collapseWhitespace(renderProse(node)).length
}

/**
 * Checks whether a paragraph sits inside a container whose paragraphs are exempt.
 *
 * @param ancestors - The paragraph's ancestor chain.
 * @returns True if any ancestor is an exempt container.
 */
export function isInsideSkippedContainer(ancestors: MarkdownNode[]): boolean {
  return ancestors.some((ancestor) => SKIPPED_CONTAINER_TYPES.some((type) => type === ancestor.type))
}

/**
 * Checks whether a file sits directly in the workspace root directory.
 *
 * @param filePath - The file path to check.
 * @returns True if the file is in the workspace root directory.
 */
export function isAtWorkspaceRoot(filePath: string): boolean {
  const workspaceRoot = findWorkspaceRoot(filePath)

  if (!workspaceRoot) {
    return false
  }

  return dirname(filePath) === workspaceRoot
}

/**
 * Checks whether a file belongs to a publishable library.
 *
 * The owning project is the nearest ancestor directory that declares one, so a README for
 * a secondary entry point counts as well as the library's own README: both ship inside the
 * published package.
 *
 * @param filePath - The file path to check.
 * @returns True if the file's owning project is a publishable library.
 */
export function isInPublishableLibrary(filePath: string): boolean {
  const projectRoot = findProjectRoot(dirname(filePath))

  if (!projectRoot) {
    return false
  }

  return isPublishableLibraryDir(projectRoot)
}

/**
 * Determines whether the rule should look at this file.
 *
 * The rule reads markdown that is either at the workspace root or inside a publishable
 * library, which is the documentation a reader outside the repository ever sees.
 *
 * @param filePath - The file path to check.
 * @returns True if the rule should apply.
 */
export function shouldApplyRule(filePath: string): boolean {
  if (!filePath.endsWith('.md')) {
    return false
  }

  return isAtWorkspaceRoot(filePath) || isInPublishableLibrary(filePath)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Flag README paragraphs that have grown into walls of text',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxCharacters: { type: 'number', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      paragraphTooLong:
        'This paragraph is {{characters}} characters, past the {{maximum}} this file allows. Consider splitting it into focused ideas, or making it more concise. Prefer clearer prose over an arbitrary break.',
    },
  },

  create(context) {
    if (!shouldApplyRule(context.filename)) {
      return {}
    }

    const options = (context.options[0] ?? {}) as ReadmeParagraphLengthOptions
    const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS

    const ancestryReader = context.sourceCode as unknown as MarkdownAncestryReader
    const readAncestors = ancestryReader.getAncestors?.bind(ancestryReader)

    let containerDepth = 0

    const checkParagraph = (node: Rule.Node): void => {
      const paragraph = node as unknown as MarkdownNode
      const inContainer = readAncestors ? isInsideSkippedContainer(readAncestors(paragraph)) : containerDepth > 0

      if (inContainer) {
        return
      }

      const characters = measureParagraph(paragraph)

      if (characters <= maxCharacters) {
        return
      }

      const position = paragraph.position

      if (!position) {
        context.report({ node, messageId: 'paragraphTooLong', data: { characters: `${characters}`, maximum: `${maxCharacters}` } })
        return
      }

      context.report({
        node,
        loc: {
          start: { line: position.start.line, column: position.start.column - 1 },
          end: { line: position.end.line, column: position.end.column - 1 },
        },
        messageId: 'paragraphTooLong',
        data: { characters: `${characters}`, maximum: `${maxCharacters}` },
      })
    }

    const listeners: Rule.RuleListener = { paragraph: checkParagraph }

    if (!readAncestors) {
      for (const type of SKIPPED_CONTAINER_TYPES) {
        listeners[type] = () => {
          containerDepth++
        }
        listeners[`${type}:exit`] = () => {
          containerDepth--
        }
      }
    }

    return listeners
  },
}

export default rule
