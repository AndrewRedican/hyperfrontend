import type { BundledLanguage } from 'shiki'
import { CODE_THEMES } from '@/lib/shiki-theme'
import { codeToTokens } from 'shiki'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** One highlighted run of text, with the colour it takes in each theme. */
export interface CodeToken {
  /** The text */
  content: string
  /** Inline style text carrying `--shiki-light` and `--shiki-dark` */
  style: string
}

/** A snippet highlighted once, ready to be drawn token by token. */
export interface HighlightedCode {
  /** The snippet as written */
  code: string
  /** The tokens, one array per line */
  lines: CodeToken[][]
  /** Inline style text for the `<pre>`, carrying the themes' foregrounds */
  rootStyle: string
  /** Class names Shiki puts on the `<pre>` so the stylesheet's theme switch finds it */
  className: string
}

/**
 * Highlight a snippet into tokens rather than HTML.
 *
 * For the one place a block is not drawn whole: a command typed out
 * character by character has to be coloured as it appears, which means the
 * colouring has to be known per token before any of it is drawn. Uses the
 * same themes as {@link highlightCode}, so a block drawn this way and a
 * block drawn as HTML are the same colours.
 *
 * @param code - The snippet
 * @param lang - The Shiki language id
 * @returns The tokens and the root style, or plain-text tokens for a language Shiki does not know
 *
 * @example
 * ```ts
 * const { lines } = await highlightTokens('npx nx dev demo-clock', 'bash')
 * lines[0][0] // { content: 'npx', style: '--shiki-light:#1D4ED8;--shiki-dark:#60A5FA' }
 * ```
 */
export async function highlightTokens(code: string, lang = 'bash'): Promise<HighlightedCode> {
  // why: an unknown language throws, and a plain-text fallback keeps the block drawable, the same choice highlightCode makes
  const result = await codeToTokens(code, { lang: lang as BundledLanguage, themes: CODE_THEMES, defaultColor: false }).catch(() =>
    codeToTokens(code, { lang: 'text', themes: CODE_THEMES, defaultColor: false })
  )
  return {
    code,
    lines: result.tokens.map((line) =>
      line.map((token) => ({
        content: token.content,
        style: entries(token.htmlStyle ?? {})
          .map(([property, value]) => `${property}:${value}`)
          .join(';'),
      }))
    ),
    rootStyle: typeof result.rootStyle === 'string' ? result.rootStyle : '',
    className: `shiki ${result.themeName}`,
  }
}
