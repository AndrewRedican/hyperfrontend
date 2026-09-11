import type { AST, Rule } from 'eslint'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the codeblock-line-width rule.
 */
export const RULE_NAME = 'codeblock-line-width'

/**
 * Rendered columns a code line may reach before it is a candidate for reformatting.
 *
 * On a phone the documentation site renders code at twelve pixels in a column about 330px
 * wide, which shows forty-five characters of a line before it scrolls; a small laptop's
 * document column shows about seventy-three at fourteen. Eighty is the first width past
 * both, where a line scrolls on every screen narrower than a mid-sized laptop, and it is
 * also the column most editors wrap at, so an author reading their own sample already
 * expects to be asked about it. Across the documentation corpus the lines this catches are
 * object literals with three or four members, calls with several arguments and shell
 * commands with a run of flags: the shapes that read better one entry per line.
 */
export const DEFAULT_MIN_LINE_LENGTH = 80

/**
 * Rendered columns past which a line's width is taken as deliberate.
 *
 * A line this wide is not a sample that grew a little past comfortable; it is a table of
 * output, a generated value, or a signature the author chose to keep whole, and asking for
 * it to be folded would be asking for a different example. The corpus has a handful of
 * lines past this and every one of them is a declaration this rule leaves alone anyway.
 */
export const DEFAULT_MAX_LINE_LENGTH = 140

/**
 * Columns a tab occupies when a line is measured, matching the `tab-size` the site renders
 * code with.
 */
export const TAB_COLUMNS = 4

/**
 * A token this long with no space in it is a hash, a path, a key or a generated value, and
 * a line carrying one is wide because of it rather than because of its structure.
 */
export const LONG_TOKEN_LENGTH = 32

/**
 * Characters inside a bracketed span before its entries count as worth a line each.
 */
const MIN_SPAN_LENGTH = 24

/**
 * Top-level entries a bracketed span needs before it reads as a list that could stand
 * vertically: three entries, which is two commas.
 */
const MIN_SPAN_COMMAS = 2

/** Flags a shell line needs before continuation lines would help. */
const MIN_SHELL_FLAGS = 2

/** Words a shell line needs before continuation lines would help, when it has fewer flags. */
const MIN_SHELL_TOKENS = 6

/**
 * Fence languages whose lines are output, data or diagrams rather than code an author
 * formats: their width is whatever the thing they show is.
 */
export const OUTPUT_LANGUAGES = createSet([
  'text',
  'txt',
  'plaintext',
  'plain',
  'console',
  'terminal',
  'ansi',
  'diff',
  'http',
  'log',
  'output',
  'mermaid',
  'markdown',
  'md',
  'csv',
])

/** Fence languages whose lines are shell commands, where a backslash continues a line. */
export const SHELL_LANGUAGES = createSet(['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'ps1', 'pwsh', 'cmd', 'bat'])

/**
 * Options accepted by the rule.
 */
export interface CodeblockLineWidthOptions {
  /** Rendered columns a line may reach before it is a candidate. */
  minLineLength?: number
  /** Rendered columns past which a line's width is taken as deliberate. */
  maxLineLength?: number
}

/**
 * A single point in a markdown source file, as mdast records it.
 */
export interface MarkdownPoint {
  /** Line number, 1-based. */
  line: number
  /** Column number, 1-based. */
  column: number
}

/**
 * The source range an mdast node covers, as far as this rule reads it.
 */
export interface MarkdownCodePosition {
  /** Where the node begins: the fence line. */
  start: MarkdownPoint
}

/**
 * The parts of an mdast code node this rule reads.
 */
export interface MarkdownCodeNode {
  /** The mdast node type, `code` for a fenced or indented block. */
  type: string
  /** The fence's language, null or absent when the fence names none. */
  lang?: string | null
  /** The block's text. */
  value?: string
  /** Source range, absent only on synthesised nodes. */
  position?: MarkdownCodePosition
}

/** Why a line could stand vertically. */
export type ReformattableShape = 'entries' | 'command'

/**
 * A line the rule would report.
 */
export interface WideLine {
  /** Zero-based offset of the line within the block's text. */
  index: number
  /** Rendered columns the line occupies. */
  width: number
  /** The shape that makes it a candidate. */
  shape: ReformattableShape
}

/**
 * Measures a line as the site renders it, with tabs expanded.
 *
 * @param line - The source line.
 * @returns Rendered columns.
 */
export function measureLine(line: string): number {
  return line.replace(/\t/g, ' '.repeat(TAB_COLUMNS)).length
}

/**
 * Whether a line is wide for a reason no reformatting would change.
 *
 * A URL, a hash or a long path is one token and cannot be folded. A comment is prose. An
 * import names one module however long its list is. A declaration or a signature is the
 * one place a reader expects to see a whole shape at once, and folding one is a stylistic
 * choice this rule has no business making.
 *
 * @param line - The trimmed source line.
 * @returns True when the line is left alone whatever its width.
 */
export function isExemptLine(line: string): boolean {
  if (/https?:\/\/|\bwww\./.test(line)) return true
  if (line.split(/\s+/).some((token) => token.length >= LONG_TOKEN_LENGTH)) return true
  if (/^(\/\/|#|\*|\/\*|<!--|--)/.test(line)) return true
  if (/^(import|export)\b/.test(line)) return true
  if (isDeclaration(line)) return true
  if (/^[\w$]+\??:\s*\(/.test(line) && line.includes('=>')) return true
  return isMethodSignature(line)
}

/** Keywords that open a declaration, after any `declare` or `async` modifier. */
const DECLARATION_KEYWORDS = createSet(['function', 'type', 'interface', 'class', 'abstract'])

/**
 * The identifier a token opens with, so `function(` reads as `function`.
 *
 * @param token - A whitespace-delimited token.
 * @returns Its leading identifier, empty when it opens with something else.
 */
function leadingWord(token: string): string {
  return /^[\w$]+/.exec(token)?.[0] ?? ''
}

/**
 * Whether a line opens a declaration: a function, a type, an interface or a class.
 *
 * @param line - The trimmed source line.
 * @returns True for a declaration line.
 */
export function isDeclaration(line: string): boolean {
  const words = line.split(/\s+/)
  let index = 0
  if (words[index] === 'declare') index++
  if (words[index] === 'async') index++
  return DECLARATION_KEYWORDS.has(leadingWord(words[index] ?? ''))
}

/**
 * Whether a line is a method signature: a name, a parameter list and a return type, with
 * no body opening and no arrow.
 *
 * @param line - The trimmed source line.
 * @returns True for a bare signature.
 */
export function isMethodSignature(line: string): boolean {
  if (line.includes('=>') || /\{\s*$/.test(line)) return false
  let index = leadingWord(line).length
  if (index === 0) return false
  if (line[index] === '<') {
    const close = line.indexOf('>', index)
    if (close === -1) return false
    index = close + 1
  }
  if (line[index] !== '(') return false
  const close = line.indexOf(')', index)
  if (close === -1) return false
  return line
    .slice(close + 1)
    .trimStart()
    .startsWith(':')
}

/**
 * Whether a bracketed span that opens and closes on this line holds three or more entries.
 *
 * Strings are skipped so a comma inside one is not an entry, and nested brackets are
 * skipped so `f(a, g(b, c))` counts two entries at the top and not three.
 *
 * @param line - The trimmed source line.
 * @returns True when the line holds a list that could stand one entry per line.
 */
export function hasFoldableSpan(line: string): boolean {
  const opens = '([{'
  const closes = ')]}'

  for (let start = 0; start < line.length; start++) {
    if (!opens.includes(line[start] as string)) continue

    let depth = 0
    let commas = 0
    let quote = ''

    for (let index = start; index < line.length; index++) {
      const char = line[index] as string
      if (quote) {
        if (char === quote) quote = ''
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char
      } else if (opens.includes(char)) {
        depth++
      } else if (closes.includes(char)) {
        depth--
        if (depth === 0) {
          if (commas >= MIN_SPAN_COMMAS && index - start - 1 >= MIN_SPAN_LENGTH) return true
          break
        }
      } else if (char === ',' && depth === 1) {
        commas++
      }
    }
  }

  return false
}

/**
 * Whether a shell line carries enough to continue over several lines.
 *
 * A quoted argument is one word however many it holds, so a long message passed to `echo`
 * is not mistaken for a run of arguments.
 *
 * @param line - The trimmed source line.
 * @returns True when the command has a run of flags or arguments.
 */
export function isFoldableCommand(line: string): boolean {
  const flags = (line.match(/(^|\s)--?[a-z]/gi) ?? []).length
  const words = line.replace(/"[^"]*"|'[^']*'/g, 'quoted').split(/\s+/).length
  return flags >= MIN_SHELL_FLAGS || words >= MIN_SHELL_TOKENS
}

/**
 * Finds the lines of a code block that are wide in a way vertical formatting would fix.
 *
 * @param code - The block's text.
 * @param lang - The fence's language, lower-cased, empty when it names none.
 * @param minLineLength - Columns a line may reach before it is a candidate.
 * @param maxLineLength - Columns past which the width is taken as deliberate.
 * @returns The candidate lines, in order.
 */
export function findWideLines(code: string, lang: string, minLineLength: number, maxLineLength: number): WideLine[] {
  if (OUTPUT_LANGUAGES.has(lang)) return []

  const wide: WideLine[] = []
  const lines = code.split('\n')

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] as string
    const width = measureLine(line)
    if (width <= minLineLength || width > maxLineLength) continue

    const trimmed = line.trim()
    if (isExemptLine(trimmed)) continue

    if (SHELL_LANGUAGES.has(lang)) {
      if (isFoldableCommand(trimmed)) wide.push({ index, width, shape: 'command' })
      continue
    }

    if (hasFoldableSpan(trimmed)) wide.push({ index, width, shape: 'entries' })
  }

  return wide
}

/**
 * Where a block's line sits in the file.
 *
 * The block's own position is its fence, so its first line of code is the line after it,
 * and the fence's indentation carries into every line of the block.
 *
 * @param node - The code node.
 * @param line - The line's offset within the block.
 * @param width - The line's rendered width.
 * @returns A source range covering the line, or null when the node carries no position.
 */
function locateLine(node: MarkdownCodeNode, line: number, width: number): AST.SourceLocation | null {
  if (!node.position) return null
  const row = node.position.start.line + 1 + line
  const column = node.position.start.column - 1
  return { start: { line: row, column }, end: { line: row, column: column + width } }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Flag code lines in documentation that are wide for their shape and would read better one entry per line',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [
      {
        type: 'object',
        properties: {
          minLineLength: { type: 'number', minimum: 1 },
          maxLineLength: { type: 'number', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      entries:
        'This code example is {{width}} columns wide, an awkward width for mobile documentation. It holds a list that could stand one entry per line; consider formatting it vertically if doing so preserves clarity.',
      command:
        'This command is {{width}} columns wide, an awkward width for mobile documentation. Consider continuing it over several lines with a trailing backslash if doing so preserves clarity.',
    },
  },

  create(context) {
    if (!context.filename.endsWith('.md')) {
      return {}
    }

    const options = (context.options[0] ?? {}) as CodeblockLineWidthOptions
    const minLineLength = options.minLineLength ?? DEFAULT_MIN_LINE_LENGTH
    const maxLineLength = options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH

    return {
      code(node: Rule.Node) {
        const block = node as unknown as MarkdownCodeNode
        const lang = (block.lang ?? '').toLowerCase()

        for (const wide of findWideLines(block.value ?? '', lang, minLineLength, maxLineLength)) {
          const loc = locateLine(block, wide.index, wide.width)
          context.report({
            node,
            ...(loc ? { loc } : {}),
            messageId: wide.shape,
            data: { width: `${wide.width}` },
          })
        }
      },
    }
  },
}

export default rule
