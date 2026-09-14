import { codeLayoutTransformer } from '@/lib/code-layout'
import { CODE_THEMES } from '@/lib/shiki-theme'
import {
  findThemedVariants,
  parseMediaReference,
  THEMED_MEDIA_CLASS,
  THEMED_MEDIA_DARK_CLASS,
  THEMED_MEDIA_LIGHT_CLASS,
} from '@/lib/themed-media'
import rehypeShiki from '@shikijs/rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { isFinite as isFiniteNumber } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** Class the scroll box around a rendered table carries; sized in `globals.css`. */
const TABLE_SCROLL_CLASS = 'table-scroll'

/** Attribute a table cell carries when it holds nothing but code spans, so the stylesheet can keep it on one line. */
const CODE_CELL_ATTRIBUTE = 'data-cell'

/**
 * Convert markdown to HTML with GitHub Flavored Markdown support and Shiki
 * syntax highlighting.
 *
 * Fenced code blocks are highlighted with this site's own dual light/dark
 * themes (`defaultColor: false`); the active palette is chosen by the `.dark`
 * class via the `pre.shiki` rules in `globals.css`. Each block is also
 * classified as compact or full from its text, and a fence's meta string
 * (`layout=full` after the language) overrides that; the meta is carried to
 * the highlighter explicitly because the raw-HTML pass below would otherwise
 * drop it. Raw HTML embedded in the markdown (mermaid placeholders, badges,
 * alignment wrappers) is preserved through `rehype-raw`, except for HTML
 * comments: authoring notes stay useful in the source files and never reach
 * the published page. Comment syntax inside a fenced code block is sample
 * text rather than a comment, so it still renders. Tables are wrapped in a
 * box that scrolls sideways, so a wide reference table moves on a phone and
 * the page does not, and a cell that holds nothing but code is marked so the
 * stylesheet can keep an identifier on one line. A picture that points at a committed media asset whose
 * record lists dark and light variants becomes a pair of images the
 * stylesheet chooses between by theme, so a light page never shows a dark
 * recording.
 *
 * @param markdown - The markdown string to convert
 * @returns A promise that resolves to the HTML string
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkCodeMeta)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeRemoveComments)
    .use(rehypeScrollTables)
    .use(rehypeCodeCells)
    .use(rehypeThemedMedia)
    .use(rehypeShiki, {
      themes: CODE_THEMES,
      defaultColor: false,
      fallbackLanguage: 'text',
      addLanguageClass: true,
      lazy: true,
      transformers: [codeLayoutTransformer()],
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown)

  return result.toString()
}

/**
 * The node data the markdown-to-hast conversion reads extra element properties from.
 */
interface FencedCodeData {
  /** Attributes written onto the element the node becomes */
  hProperties?: Record<string, string>
}

/**
 * The subset of an mdast code node the meta pass reads and writes.
 */
interface FencedCodeNode {
  /** Node type, `'code'` for a fenced block */
  type: string
  /** Everything after the language on the fence line, absent when there is none */
  meta?: string | null
  /** Where the hast conversion reads extra element properties from */
  data?: FencedCodeData
  /** Child nodes, absent on leaves */
  children?: FencedCodeNode[]
}

/**
 * Remark plugin that copies a fence's meta string onto the element it becomes.
 *
 * The markdown-to-hast step already records the meta as node data, but the
 * raw-HTML pass rebuilds every element and keeps only its attributes, so by
 * the time the highlighter looks for it the data is gone. Written as the
 * `metastring` attribute instead, it survives the rebuild, and `metastring`
 * is the attribute the highlighter already reads a fence's meta from.
 *
 * @returns The tree transformer
 */
function remarkCodeMeta(): (tree: FencedCodeNode) => void {
  return (tree) => {
    stampCodeMeta(tree)
  }
}

/**
 * Write every fenced block's meta beneath a node onto its element properties.
 *
 * @param node - Node whose subtree is stamped
 */
function stampCodeMeta(node: FencedCodeNode): void {
  if (node.type === 'code' && node.meta) {
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, metastring: node.meta } }
  }
  for (const child of node.children ?? []) {
    stampCodeMeta(child)
  }
}

/**
 * The subset of a hast element the table pass needs.
 */
interface WrappableNode {
  /** Node type, `'element'` for a tag */
  type: string
  /** Tag name, present on elements */
  tagName?: string
  /** Attributes, present on elements */
  properties?: Record<string, unknown>
  /** Child nodes, absent on leaves */
  children?: WrappableNode[]
}

/**
 * Rehype plugin that puts every table inside a horizontally scrolling box.
 *
 * Done in the tree rather than in the stylesheet because the alternative,
 * making the table itself the scroll container, means giving it a block
 * display and losing its table semantics to assistive technology. A wrapper
 * costs nothing a reader can see and keeps the table a table.
 *
 * @returns The tree transformer
 */
function rehypeScrollTables(): (tree: WrappableNode) => void {
  return (tree) => {
    wrapTables(tree)
  }
}

/**
 * Wrap every table beneath a node in a scroll box, in place.
 *
 * @param node - Node whose subtree is wrapped
 */
function wrapTables(node: WrappableNode): void {
  if (!node.children) {
    return
  }

  // why: descendants first, so the boxes added here are never walked into and a table is boxed exactly once
  for (const child of node.children) {
    wrapTables(child)
  }

  node.children = node.children.map((child) =>
    child.type === 'element' && child.tagName === 'table'
      ? { type: 'element', tagName: 'div', properties: { className: [TABLE_SCROLL_CLASS] }, children: [child] }
      : child
  )
}

/**
 * Rehype plugin that marks table cells made only of code spans.
 *
 * A reference table's identifier column (a handler name, an event, a path) is
 * the column a reader scans, and it is the one the browser squeezes hardest
 * when a prose column beside it wants the width. The stylesheet can keep such
 * a cell on one line only if it can tell it apart, and the tree is where that
 * is known: a cell whose children are code elements, and at most the
 * whitespace and punctuation between them, is one identifier or a short list
 * of them.
 *
 * @returns The tree transformer
 */
function rehypeCodeCells(): (tree: WrappableNode) => void {
  return (tree) => {
    markCodeCells(tree)
  }
}

/**
 * Mark every code-only cell beneath a node, in place.
 *
 * @param node - Node whose subtree is marked
 */
function markCodeCells(node: WrappableNode): void {
  if (!node.children) {
    return
  }
  for (const child of node.children) {
    if (child.type === 'element' && (child.tagName === 'td' || child.tagName === 'th') && isCodeOnly(child)) {
      child.properties = { ...child.properties, [CODE_CELL_ATTRIBUTE]: 'code' }
    }
    markCodeCells(child)
  }
}

/**
 * Whether a cell holds at least one code span and nothing else but the
 * separators between spans.
 *
 * @param cell - The table cell being judged
 * @returns True for a cell the stylesheet should keep on one line
 */
function isCodeOnly(cell: WrappableNode): boolean {
  const children = cell.children ?? []
  let codeSpans = 0
  for (const child of children) {
    if (child.type === 'element' && child.tagName === 'code') {
      codeSpans += 1
      continue
    }
    if (
      child.type === 'element' &&
      child.tagName === 'a' &&
      (child.children ?? []).every((inner) => inner.type === 'element' && inner.tagName === 'code')
    ) {
      codeSpans += 1
      continue
    }
    if (child.type === 'text' && /^[\s,;/|·]*$/.test(String((child as TextNode).value ?? ''))) {
      continue
    }
    return false
  }
  return codeSpans > 0
}

/**
 * The subset of a hast text node the cell pass reads.
 */
interface TextNode {
  /** Node type, `'text'` */
  type: string
  /** The text */
  value?: string
}

/**
 * Rehype plugin that swaps a themed media asset for the pair of images the
 * stylesheet chooses between.
 *
 * A readme embeds the portable variant of a recording, because a readme is
 * rendered on pages whose theme nobody here controls. This site controls its
 * own, so where the recorder's record lists dark and light variants beside
 * the portable one, both are put in the page and the active theme decides
 * which shows. Both images are lazy, and a lazy image that is not displayed
 * is never fetched, so switching theme costs one download and the initial
 * load costs none it did not already need. The size from the record is
 * written onto both images, so the stage holds its shape before either
 * arrives.
 *
 * @returns The tree transformer
 */
function rehypeThemedMedia(): (tree: WrappableNode) => void {
  return (tree) => {
    swapThemedMedia(tree)
  }
}

/**
 * Replace every themed picture beneath a node with its pair, in place.
 *
 * @param node - Node whose subtree is rewritten
 */
function swapThemedMedia(node: WrappableNode): void {
  if (!node.children) {
    return
  }
  node.children = node.children.map((child) => {
    if (child.type !== 'element' || child.tagName !== 'img') {
      swapThemedMedia(child)
      return child
    }
    const src = child.properties?.['src']
    const reference = typeof src === 'string' ? parseMediaReference(src) : null
    const variants = reference === null ? null : findThemedVariants(reference)
    if (variants === null) {
      return child
    }
    const shared: Record<string, unknown> = { ...child.properties, loading: 'lazy' }
    if (variants.width !== undefined && variants.height !== undefined) {
      // why: a picture with no stated size has no box until it arrives, and the page jumps when it does; the record knows the size, so it is written in, scaled to any width the author did state
      const stated = Number(shared['width'])
      const width = isFiniteNumber(stated) && stated > 0 ? stated : variants.width
      shared['width'] = width
      shared['height'] = shared['height'] ?? round((width * variants.height) / variants.width)
    }
    const image = (variant: string, className: string): WrappableNode => ({
      type: 'element',
      tagName: 'img',
      properties: { ...shared, src: variant, className: [className] },
      children: [],
    })
    return {
      type: 'element',
      tagName: 'span',
      properties: { className: [THEMED_MEDIA_CLASS] },
      children: [image(variants.light, THEMED_MEDIA_LIGHT_CLASS), image(variants.dark, THEMED_MEDIA_DARK_CLASS)],
    }
  })
}

/**
 * Convert a single line of markdown to inline HTML, without the wrapping
 * paragraph.
 *
 * For short authored strings that live in metadata rather than in a document
 * body: a guide's prerequisites, for example, which are sentences an author
 * writes and should be able to punctuate with a link or a code span. Raw HTML
 * and syntax highlighting are deliberately absent; a metadata line is a
 * sentence, not a document.
 *
 * @param markdown - One line of markdown
 * @returns A promise resolving to HTML with no block wrapper
 *
 * @example Link and code-format a prerequisite
 * ```ts
 * await markdownToInlineHtml('A value that throws on [`JSON.stringify`](https://example.com)')
 * // 'A value that throws on <a href="https://example.com"><code>JSON.stringify</code></a>'
 * ```
 */
export async function markdownToInlineHtml(markdown: string): Promise<string> {
  const result = await remark().use(remarkGfm).use(remarkRehype).use(rehypeStringify).process(markdown)
  return result
    .toString()
    .trim()
    .replace(/^<p>/, '')
    .replace(/<\/p>$/, '')
}

/**
 * The subset of a hast node the comment pass needs: its type, and its children
 * when it is a container.
 */
interface CommentableNode {
  /** Node type, `'comment'` for an HTML comment */
  type: string
  /** Child nodes, absent on leaves */
  children?: CommentableNode[]
}

/**
 * Rehype plugin that drops HTML comments so in-source authoring notes never
 * render.
 *
 * Comments are removed from the parsed tree rather than from the markdown
 * text. A textual `<!--`...`-->` strip is both incomplete and overreaching:
 * overlapping markers reassemble into a live comment once an inner one is
 * removed, and comment syntax inside fenced code blocks is sample content that
 * must survive to the page.
 *
 * @returns The tree transformer
 */
function rehypeRemoveComments(): (tree: CommentableNode) => void {
  return (tree) => {
    removeComments(tree)
  }
}

/**
 * Drop every comment node beneath a hast node, in place.
 *
 * @param node - Node whose subtree is filtered
 */
function removeComments(node: CommentableNode): void {
  if (!node.children) {
    return
  }

  node.children = node.children.filter((child) => child.type !== 'comment')

  for (const child of node.children) {
    removeComments(child)
  }
}

/**
 * Extract the first paragraph from markdown content
 *
 * @param content - The markdown content to extract from
 * @returns The first paragraph as a string
 */
export function extractDescription(content: string): string {
  const lines = content.split('\n')
  let foundContent = false
  const paragraphLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('#')) {
      foundContent = false
      continue
    }

    if (!foundContent && line.trim() === '') {
      continue
    }

    if (line.includes('[![') || line.includes('<p align=') || line.trimStart().startsWith('<!--')) {
      continue
    }

    if (line.trim()) {
      foundContent = true
      paragraphLines.push(line)
    } else if (foundContent) {
      break
    }
  }

  return paragraphLines.join(' ').trim()
}

/**
 * Add language classes to code blocks for syntax highlighting
 *
 * @param html - The HTML string containing code blocks
 * @returns The HTML with processed code blocks
 */
export function processCodeBlocks(html: string): string {
  return html.replace(/<pre><code class="language-(\w+)">/g, '<pre data-language="$1"><code class="language-$1">')
}

/**
 * Convert markdown tables to styled HTML tables
 *
 * @param html - The HTML string containing tables
 * @returns The HTML with styled table classes
 */
export function processMarkdownTables(html: string): string {
  return html
    .replace(/<table>/g, '<table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">')
    .replace(/<thead>/g, '<thead class="bg-slate-50 dark:bg-slate-800">')
    .replace(/<th>/g, '<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">')
    .replace(/<tbody>/g, '<tbody class="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">')
    .replace(/<td>/g, '<td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">')
}

export { generateSlug } from './slug'
