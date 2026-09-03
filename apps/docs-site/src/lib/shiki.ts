import { codeToHtml } from 'shiki'

/**
 * Light/dark theme pair used everywhere code is highlighted. Paired with
 * `defaultColor: false` so Shiki emits CSS variables for both themes and the
 * active one is chosen by the `.dark` class (see `pre.shiki` rules in
 * `globals.css`).
 */
const THEMES = { light: 'github-light', dark: 'github-dark' } as const

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
    return await codeToHtml(code, { lang, themes: THEMES, defaultColor: false })
  } catch {
    // why: an unknown language throws; fall back to plain text so the block still renders instead of breaking the page.
    return await codeToHtml(code, { lang: 'text', themes: THEMES, defaultColor: false })
  }
}
