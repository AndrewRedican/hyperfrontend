import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

/**
 * Convert markdown to HTML with GitHub Flavored Markdown support
 *
 * @param markdown - The markdown string to convert
 * @returns A promise that resolves to the HTML string
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(markdown)

  return result.toString()
}

/**
 * Extract the first paragraph from markdown content
 *
 * @param content - The markdown content to extract from
 * @returns The first paragraph as a string
 */
export function extractDescription(content: string): string {
  // Skip headers and find first paragraph
  const lines = content.split('\n')
  let foundContent = false
  const paragraphLines: string[] = []

  for (const line of lines) {
    // Skip headers
    if (line.startsWith('#')) {
      foundContent = false
      continue
    }

    // Skip empty lines before content
    if (!foundContent && line.trim() === '') {
      continue
    }

    // Skip badge lines
    if (line.includes('[![') || line.includes('<p align=')) {
      continue
    }

    // Found content
    if (line.trim()) {
      foundContent = true
      paragraphLines.push(line)
    } else if (foundContent) {
      // End of paragraph
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
  // Add language classes to code blocks for client-side highlighting
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
