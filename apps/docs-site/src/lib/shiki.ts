import { CODE_THEMES } from '@/lib/shiki-theme'
import { codeToHtml } from 'shiki'

/**
 * Highlight a snippet to dual-theme Shiki HTML for inline rendering.
 *
 * @param code - The raw source to highlight.
 * @param lang - The Shiki/TextMate language id (e.g. `bash`, `typescript`). Defaults to `bash`.
 * @returns A promise resolving to a `<pre class="shiki">…</pre>` HTML string.
 *
 * @example
 * ```ts
 * const html = await highlightCode('npm install @hyperfrontend/features', 'bash')
 * ```
 */
export async function highlightCode(code: string, lang = 'bash'): Promise<string> {
  try {
    return await codeToHtml(code, { lang, themes: CODE_THEMES, defaultColor: false })
  } catch {
    // why: an unknown language throws; fall back to plain text so the block still renders instead of breaking the page.
    return await codeToHtml(code, { lang: 'text', themes: CODE_THEMES, defaultColor: false })
  }
}
