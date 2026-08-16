import rehypeShiki from '@shikijs/rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'

/**
 * Convert markdown to HTML with GitHub Flavored Markdown support and Shiki
 * syntax highlighting.
 *
 * Fenced code blocks are highlighted with dual light/dark themes
 * (`defaultColor: false`); the active palette is chosen by the `.dark` class
 * via the `pre.shiki` rules in `globals.css`. Raw HTML embedded in the markdown
 * (mermaid placeholders, badges, alignment wrappers) is preserved through
 * `rehype-raw`, except for HTML comments: authoring notes stay useful in the
 * source files and never reach the published page. Comment syntax inside a
 * fenced code block is sample text rather than a comment, so it still renders.
 *
 * @param markdown - The markdown string to convert
 * @returns A promise that resolves to the HTML string
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeRemoveComments)
    .use(rehypeShiki, {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      fallbackLanguage: 'text',
      lazy: true,
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown)

  return result.toString()
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

    if (line.includes('[![') || line.includes('<p align=')) {
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
