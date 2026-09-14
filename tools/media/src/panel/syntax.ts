import type { ThemeSyntax } from '../models/theme'
import { escapeHtml } from '../lib/escape-html'

/**
 * The words the tokeniser knows.
 *
 * A deliberately short list. A stage is not a highlighter and does not have a
 * grammar; what it has is enough colour that a pane of source reads as source
 * rather than as a paragraph in a monospace face. Anything this misses is set
 * in the panel's own colour, which is the right failure.
 */
const KEYWORDS: readonly string[] = [
  'as',
  'async',
  'await',
  'const',
  'export',
  'from',
  'function',
  'if',
  'import',
  'interface',
  'let',
  'new',
  'return',
  'throw',
  'type',
  'typeof',
  'catch',
  'try',
  'for',
  'of',
  'in',
  'class',
  'extends',
  'null',
  'true',
  'false',
  'undefined',
]

/**
 * One run of a line that shares a colour.
 *
 * A pattern that matches, and the field of {@link ThemeSyntax} its
 * matches are painted with. Order matters: the first pattern to match at a
 * position wins, so comments and strings come before anything that could be
 * found inside one.
 */
interface TokenRule {
  /** What the run looks like, anchored at the current position. */
  pattern: RegExp
  /** Which colour the run takes. */
  colour: keyof ThemeSyntax
}

/**
 * Every run worth colouring, in the order they are tried.
 *
 * Every pattern here is star height one, which is a real constraint rather than
 * a style: a quantifier wrapping a quantifier is what the workspace's
 * backtracking check refuses, and it refuses it structurally rather than by
 * proving a given case safe. So a string literal is a run up to its closing
 * quote and nothing cleverer, which means an embedded escaped quote ends the
 * colouring early. Scene panes carry short literals written by hand, so that
 * has no case to be wrong in, and a mis-coloured quote would cost a shade
 * rather than a fact.
 */
const RULES: readonly TokenRule[] = [
  { pattern: /^\/\/.*$/, colour: 'comment' },
  { pattern: /^'[^'\n]*'/, colour: 'string' },
  { pattern: /^"[^"\n]*"/, colour: 'string' },
  { pattern: /^`[^`\n]*`/, colour: 'string' },
  { pattern: /^\d[\d_.]*/, colour: 'number' },
  { pattern: /^[A-Za-z_$][\w$]*(?=\s*\()/, colour: 'call' },
  { pattern: /^[A-Za-z_$][\w$]*/, colour: 'keyword' },
  { pattern: /^[{}[\]().,;:=><+\-*/!?&|]+/, colour: 'punctuation' },
]

/**
 * Colour one line of source.
 *
 * A single left-to-right pass with no state carried between lines, which is
 * both what keeps it honest for a stage that is redrawn from scratch every
 * frame and what makes a multi-line template literal come out uncoloured. Lines
 * in these panes are short and self-contained, so that trade costs nothing.
 *
 * The word rule runs last of the two identifier rules and only paints a word
 * that is in {@link KEYWORDS}; anything else is emitted plain, so a variable
 * name is not given the weight of a language word.
 *
 * @param line - One line of source, unescaped.
 * @param colours - The palette to paint with.
 * @returns HTML for the line, already escaped.
 * @example Colouring a call
 * ```ts
 * highlight("const n = encrypt('secret')", theme.syntax)
 * ```
 */
export function highlight(line: string, colours: ThemeSyntax): string {
  let rest = line
  let out = ''

  while (rest.length > 0) {
    const leading = /^\s+/.exec(rest)
    if (leading !== null) {
      out += escapeHtml(leading[0])
      rest = rest.slice(leading[0].length)
      continue
    }

    let matched = false
    for (const rule of RULES) {
      const found = rule.pattern.exec(rest)
      if (found === null) {
        continue
      }
      const text = found[0]
      const plain = rule.colour === 'keyword' && !KEYWORDS.includes(text)
      out += plain ? escapeHtml(text) : `<span style="color:${colours[rule.colour]}">${escapeHtml(text)}</span>`
      rest = rest.slice(text.length)
      matched = true
      break
    }

    if (!matched) {
      out += escapeHtml(rest.slice(0, 1))
      rest = rest.slice(1)
    }
  }

  return out
}
