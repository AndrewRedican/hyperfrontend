import type { Rule } from 'eslint'
import { dirname, relative, sep } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { findNxWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the no-manual-table-of-contents rule.
 */
export const RULE_NAME = 'no-manual-table-of-contents'

/**
 * The directory, relative to the workspace root, whose markdown the rule governs.
 *
 * Library documentation is what the documentation site renders with an on-page index of
 * its own, so a hand-written one there is redundant. An application's readme, a guide,
 * and the workspace's own documents are not rendered that way and are left alone.
 */
export const LIBRARIES_DIR = 'libs'

/**
 * Headings that name a table of contents, after normalisation.
 *
 * Compared whole, so `Table of Contents`, `Table Of Content`, `Contents`, `Index`,
 * `Document Index`, `Quick Index` and `TOC` are all caught, while `Index Signatures`,
 * `Content Security Policy` and `Indexing the cache` are not: those headings carry words
 * outside the list, so they are about something rather than a list of what follows.
 * `Content` on its own is left out on purpose; singular, it is as often a section about
 * what something holds as an index of a page.
 */
const TOC_HEADINGS = createSet([
  'table of contents',
  'table of content',
  'contents',
  'toc',
  'index',
  'index of contents',
  'document index',
  'page index',
  'section index',
  'quick index',
  'full index',
  'document contents',
  'page contents',
  'section contents',
  'quick contents',
  'in this document',
  'in this page',
  'in this section',
  'in this guide',
])

/**
 * Trailing decoration a heading may carry that says nothing about what it is.
 */
const TRAILING_DECORATION = /[\s:.\-–—]+$/

/**
 * The parts of an mdast node this rule reads.
 */
export interface MarkdownNode {
  /** The node type: `heading`, `text`, `inlineCode` and so on. */
  type: string
  /** The heading level, present on headings. */
  depth?: number
  /** The text of a text or code node. */
  value?: string
  /** Child nodes, absent on leaves. */
  children?: MarkdownNode[]
}

/**
 * The text a heading renders, inline markup stripped.
 *
 * @param node - The heading, or a node beneath it.
 * @returns The rendered text.
 */
export function headingText(node: MarkdownNode): string {
  if (node.value !== undefined) {
    return node.value
  }
  return (node.children ?? []).map(headingText).join('')
}

/**
 * Whether a heading names a table of contents or an equivalent index.
 *
 * Compared after lower-casing, collapsing whitespace and dropping trailing punctuation,
 * so the permutations authors actually write are one pattern rather than a list. A
 * heading has to be *only* such a name to match: a word like `index` is also a
 * technical term, and `Index Signatures` or `Indexing` is a section about something.
 *
 * @param text - The heading's rendered text.
 * @returns True when the heading introduces a manual table of contents.
 * @example Permutations that match, and technical uses that do not
 * ```ts
 * isTableOfContentsHeading('Table of Contents') // true
 * isTableOfContentsHeading('Contents:') // true
 * isTableOfContentsHeading('Index') // true
 * isTableOfContentsHeading('Index Signatures') // false
 * ```
 */
export function isTableOfContentsHeading(text: string): boolean {
  const normalised = text.toLowerCase().replace(TRAILING_DECORATION, '').replace(/\s+/g, ' ').trim()
  return TOC_HEADINGS.has(normalised)
}

/**
 * Whether a markdown file belongs to a library project.
 *
 * @param filename - Absolute path of the file being linted.
 * @returns True when the file sits under the workspace's libraries directory.
 */
export function isLibraryMarkdown(filename: string): boolean {
  if (!filename.endsWith('.md')) {
    return false
  }
  const workspaceRoot = findNxWorkspaceRoot(dirname(filename))
  if (workspaceRoot === null) {
    return false
  }
  const [first] = relative(workspaceRoot, filename).split(sep)
  return first === LIBRARIES_DIR
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hand-written table-of-contents sections in library markdown; the documentation site generates on-page navigation',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [],
    messages: {
      manualTableOfContents:
        'Manual table-of-contents sections are not allowed in library markdown. The documentation site generates on-page navigation from the headings, so this "{{heading}}" section is redundant: remove the heading and the list under it rather than disabling this rule or hiding the section in the renderer.',
    },
  },

  create(context) {
    if (!isLibraryMarkdown(context.filename)) {
      return {}
    }

    return {
      heading(node: MarkdownNode) {
        const text = headingText(node).trim()
        if (isTableOfContentsHeading(text)) {
          context.report({ node: node as unknown as Rule.Node, messageId: 'manualTableOfContents', data: { heading: text } })
        }
      },
    }
  },
}

export default rule
