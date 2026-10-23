/**
 * A documentation code line that is wide only because it crams a list onto one line is reported,
 * so it gets folded one entry per line before a phone reader has to scroll it. A line is a
 * candidate when its rendered width falls between the floor and the ceiling; it is reported when
 * nothing marks it as wide by design and it has a foldable shape: a shell command with several
 * flags or words, or a bracketed span with several entries that opens and closes on the line.
 *
 * @module rules/conventions/codeblock-line-width
 */

import type { MarkdownNode } from '../../markdown/model'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'

/** The rule's options. */
interface Options {
  /** Rendered columns a line may reach before it is a candidate. */
  readonly minLineLength?: number
  /** Rendered columns past which a line's width is taken as deliberate. */
  readonly maxLineLength?: number
}

/** The fence languages whose lines are commands. */
const SHELL = createSet(['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'pwsh', 'ps1', 'cmd', 'bat'])

/** The fence languages whose lines show output, data or a diagram, and keep whatever width that takes. */
const VERBATIM = createSet([
  'text',
  'txt',
  'plain',
  'plaintext',
  'output',
  'log',
  'ansi',
  'console',
  'terminal',
  'diff',
  'http',
  'mermaid',
  'md',
  'markdown',
  'csv',
])

// context: what makes a line wide by design, read from the line as written or with its indentation removed.
const BY_DESIGN: readonly ((line: string, code: string) => boolean)[] = [
  // why: a URL, a hash, a path or a key is one token that no folding shortens.
  (line) => /https?:\/\/|\bwww\.|\S{32}/.test(line),
  (_, code) => ['//', '#', '*', '/*', '<!--', '--'].some((opener) => code.startsWith(opener)),
  (_, code) => /^(?:import|export)\b/.test(code),
  // lint-disable-next-line no-unsafe-regex -- anchored, and each optional word must end in whitespace before the next
  (_, code) => /^(?:declare\s+)?(?:async\s+)?(?:function|type|interface|class|abstract)(?![\w$])/.test(code),
  (_, code) => /^[\w$]+\??:\s*\(.*=>/.test(code),
  (line, code) => !line.trimEnd().endsWith('{') && opensSignature(code),
]

/** The characters that open and close a bracketed span. */
const OPENERS = '([{'
const CLOSERS = ')]}'

/** The quotes that open a string a span scan steps over. */
const QUOTES = `'"\``

/** A span shorter than this, brackets included, reads fine however many entries it holds. */
const SHORTEST_FOLDABLE_SPAN = 26

/** A shell word: unquoted characters and quoted runs, glued together. */
const SHELL_WORD = /(?:[^\s'"]+|'[^']*'|"[^"]*")+/g

/**
 * Tells whether a line opens with a method signature: a name, optional type parameters, a
 * parameter list up to its first closing parenthesis, and a colon for the return type.
 *
 * @param code - The line with its indentation removed
 * @returns True for a signature
 */
function opensSignature(code: string): boolean {
  const name = /^[\w$]+/.exec(code)
  if (name === null) return false
  let at = name[0].length
  if (code[at] === '<') {
    let depth = 0
    do {
      if (code[at] === '<') depth += 1
      else if (code[at] === '>') depth -= 1
      at += 1
    } while (depth > 0 && at < code.length)
    if (depth > 0) return false
  }
  if (code[at] !== '(') return false
  const close = code.indexOf(')', at)
  return close !== -1 && /^\s*:/.test(code.slice(close + 1))
}

/**
 * Finds where a string that opens at an offset ends, stepping over escaped characters.
 *
 * @param line - A line of a fenced code block
 * @param open - The offset of the opening quote
 * @returns The offset of the closing quote, or the line's length when the string never closes
 */
function stringEnd(line: string, open: number): number {
  let at = open + 1
  while (at < line.length && line[at] !== line[open]) at += line[at] === '\\' ? 2 : 1
  return min(at, line.length)
}

/**
 * Tells whether the span that opens at an offset closes on the line, long enough and holding
 * three or more entries: commas at its own depth, strings and nested spans stepped over.
 *
 * @param line - A line of a fenced code block
 * @param open - The offset of an opening bracket
 * @returns True when the span is foldable
 */
function spanFolds(line: string, open: number): boolean {
  let depth = 0
  let commas = 0
  for (let at = open + 1; at < line.length; at += 1) {
    const character = line[at] as string
    if (QUOTES.includes(character)) at = stringEnd(line, at)
    else if (OPENERS.includes(character)) depth += 1
    else if (CLOSERS.includes(character)) {
      if (depth === 0) return commas >= 2 && at - open + 1 >= SHORTEST_FOLDABLE_SPAN
      depth -= 1
    } else if (character === ',' && depth === 0) commas += 1
  }
  return false
}

/**
 * Measures the columns a line renders at, a tab taking four.
 *
 * @param line - A line of a fenced code block, indentation included
 * @returns The length in characters, each tab counting four
 */
function widthOf(line: string): number {
  return line.length + 3 * (line.match(/\t/g)?.length ?? 0)
}

/**
 * Names the foldable shape of a code line, if it has one.
 *
 * @param line - A line of a fenced code block
 * @param shell - Whether the block holds commands
 * @returns `command`, `entries`, or undefined
 */
function foldableShape(line: string, shell: boolean): 'command' | 'entries' | undefined {
  const code = line.trimStart()
  if (BY_DESIGN.some((test) => test(line, code))) return undefined
  if (shell) {
    const words = [...line.matchAll(SHELL_WORD)].map(([word]) => word)
    return words.length >= 6 || words.filter((word) => /^--?[A-Za-z]/.test(word)).length >= 2 ? 'command' : undefined
  }
  for (let at = 0; at < line.length; at += 1) if (OPENERS.includes(line[at] as string) && spanFolds(line, at)) return 'entries'
  return undefined
}

export default defineRule<Options | undefined, MarkdownNode>({
  id: 'codeblock-line-width',
  language: 'markdown',
  fixable: false,
  create(context) {
    const floor = context.options?.minLineLength ?? 80
    const ceiling = context.options?.maxLineLength ?? 140
    return {
      code(node) {
        const language = (node.lang ?? '').toLowerCase()
        if (VERBATIM.has(language)) return
        const { starts } = context.file.lines
        const { line: fence, column } = node.position.start
        const lines = (node.value as string).split(/\r?\n/)
        for (const [index, line] of lines.entries()) {
          const width = widthOf(line)
          if (width <= floor || width > ceiling) continue
          const shape = foldableShape(line, SHELL.has(language))
          if (shape === undefined) continue
          // why: the first content line is counted from the line after the node opens, which for an indented block is its own first line.
          const row = fence + 1 + index
          const at = { line: row, column: column - 1, endLine: row, endColumn: column - 1 + width }
          const advice =
            shape === 'command'
              ? `This command is ${width} columns wide, an awkward width for mobile documentation. Consider continuing it over several lines with a trailing backslash if doing so preserves clarity.`
              : `This code example is ${width} columns wide, an awkward width for mobile documentation. It holds a list that could stand one entry per line; consider formatting it vertically if doing so preserves clarity.`
          context.report({ start: (starts[min(row, starts.length) - 1] as number) + at.column, message: advice, at })
        }
      },
    }
  },
})
