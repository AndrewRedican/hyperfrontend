/**
 * Prefix every selector in a stylesheet with a scope.
 *
 * Two chapters of a sequence may be drawn by the same stage with different
 * configurations, and a stage writes configuration into its stylesheet (a
 * stacked panel frame, a phase caption's room). Mounting both stylesheets
 * unscoped would let the second chapter's rules restyle the first, so each is
 * confined to its own element before it is mounted.
 *
 * The stylesheets this handles are the ones stages write: flat rule sets with
 * block comments and no at-rules. That is a deliberate limit rather than an
 * oversight, because a stage is forbidden animations and media queries anyway.
 *
 * @param css - A stage's stylesheet.
 * @param scope - The selector every rule is confined under.
 * @returns The same rules, each selector prefixed.
 * @example Confining a stage to one chapter
 * ```ts
 * scopeCss('.p-row { color: red; } .p-row--lit, .p-caret { color: blue; }', '.seq-chapter--1')
 * // '.seq-chapter--1 .p-row { color: red; } .seq-chapter--1 .p-row--lit, .seq-chapter--1 .p-caret { color: blue; }'
 * ```
 */
export function scopeCss(css: string, scope: string): string {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return stripped.replace(/([^{}]+)\{([^{}]*)\}/g, (_rule, selectors: string, body: string) => {
    const scoped = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter((selector) => selector !== '')
      .map((selector) => `${scope} ${selector}`)
      .join(', ')
    return `${scoped} {${body}}\n`
  })
}
