/**
 * The JSDoc block parser: a `/** ... *\/` comment read line by line into the tokens each line
 * is made of, so that a rule can inspect a tag's name, type and description and rewrite a line
 * without disturbing its spacing, as the previous linter's comment parser laid them out.
 *
 * @module jsdoc/parse
 */

import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The pieces of one line of a block, in order; stringified back, they give the line. */
export interface JsdocTokens {
  /** The whitespace before the delimiter. */
  start: string
  /** `/**` on the first line, `*` on a line that has one, nothing otherwise. */
  delimiter: string
  /** The whitespace after the delimiter. */
  postDelimiter: string
  /** The tag with its `@`, on a line that opens one. */
  tag: string
  /** The whitespace after the tag. */
  postTag: string
  /** The type with its braces. */
  type: string
  /** The whitespace after the type. */
  postType: string
  /** The name, with its brackets and default when it has them. */
  name: string
  /** The whitespace after the name. */
  postName: string
  /** The rest of the line. */
  description: string
  /** `*\/` with the whitespace before it, on the last line. */
  end: string
  /** The carriage return of a CRLF line. */
  lineEnd: string
}

/** One line of a block. */
export interface JsdocLine {
  /** The offset in the file where the line's first token starts. */
  readonly offset: number
  /** The 1-based line number in the file. */
  readonly number: number
  /** The line's tokens. */
  readonly tokens: JsdocTokens
}

/** One tag of a block. */
export interface JsdocTag {
  /** The tag's name without its `@`. */
  readonly tag: string
  /** The name without brackets, quotes or default. */
  readonly name: string
  /** The type without its braces. */
  readonly type: string
  /** Whether the name was bracketed. */
  readonly optional: boolean
  /** The default given in the brackets, or null. */
  readonly default: string | null
  /** Whether the name's brackets were left unpaired, which leaves the tag without a name. */
  readonly unpaired: boolean
  /** The description, lines joined by line feeds. */
  readonly description: string
  /** The tag's lines: the one opening it and those continuing it. */
  readonly lines: readonly JsdocLine[]
  /** The index of the opening line among the block's lines. */
  readonly index: number
}

/** A parsed block. */
export interface JsdocBlock {
  /** The offset of `/**`. */
  readonly start: number
  /** The offset after `*\/`. */
  readonly end: number
  /** The description before the first tag, lines joined by line feeds. */
  readonly description: string
  /** The tags, in order. */
  readonly tags: readonly JsdocTag[]
  /** Every line, the opening and closing ones included. */
  readonly lines: readonly JsdocLine[]
}

/** The tags whose text after them is never a type, even in braces. */
const TYPELESS = createSet<string>([
  'default',
  'defaultvalue',
  'description',
  'example',
  'file',
  'fileoverview',
  'license',
  'overview',
  'see',
  'summary',
])

/** The tags whose text after them is never a name. */
const NAMELESS = createSet<string>([
  'access',
  'author',
  'default',
  'defaultvalue',
  'description',
  'example',
  'exception',
  'file',
  'fileoverview',
  'kind',
  'license',
  'overview',
  'return',
  'returns',
  'since',
  'summary',
  'throws',
  'version',
  'variation',
])

/**
 * Splits leading whitespace off a text.
 *
 * @param text - The text whose leading whitespace is split off
 * @returns The whitespace and the rest
 */
function splitSpace(text: string): [string, string] {
  let index = 0
  while (index < text.length && (text[index] === ' ' || text[index] === '\t')) index += 1
  return [text.slice(0, index), text.slice(index)]
}

/**
 * The tokens of one line of a comment.
 *
 * @param line - The line's text, without its line feed
 * @param first - Whether it is the comment's first line
 * @returns The tokens, with the text after the delimiter still in `description`
 */
function lineTokens(line: string, first: boolean): JsdocTokens {
  const tokens: JsdocTokens = {
    start: '',
    delimiter: '',
    postDelimiter: '',
    tag: '',
    postTag: '',
    type: '',
    postType: '',
    name: '',
    postName: '',
    description: '',
    end: '',
    lineEnd: '',
  }
  let rest = line
  if (rest.endsWith('\r')) {
    tokens.lineEnd = '\r'
    rest = rest.slice(0, -1)
  }
  ;[tokens.start, rest] = splitSpace(rest)
  if (first) {
    tokens.delimiter = '/**'
    ;[tokens.postDelimiter, rest] = splitSpace(rest.slice(3))
  } else if (rest.startsWith('*') && !rest.startsWith('*/')) {
    tokens.delimiter = '*'
    ;[tokens.postDelimiter, rest] = splitSpace(rest.slice(1))
  }
  const trimmed = rest.trimEnd()
  if (trimmed.endsWith('*/')) {
    tokens.end = rest.slice(trimmed.length - 2)
    rest = trimmed.slice(0, -2)
  }
  tokens.description = rest
  return tokens
}

/**
 * Reads the tag, type and name tokens off the lines of one tag, leaving the rest as description.
 *
 * @param lines - The tag's lines, the opening one first
 * @param index - The index of the opening line among the block's lines
 * @returns What the lines say about the tag
 */
function readTag(lines: JsdocLine[], index: number): JsdocTag {
  const first = (lines[0] as JsdocLine).tokens
  const tagEnd = first.description.search(/\s/)
  first.tag = tagEnd === -1 ? first.description : first.description.slice(0, tagEnd)
  ;[first.postTag, first.description] = splitSpace(first.description.slice(first.tag.length))
  const tag = first.tag.slice(1)
  let type = ''
  if (!TYPELESS.has(tag)) type = readType(lines)
  let name = ''
  let optional = false
  let defaultValue: string | null = null
  let unpaired = false
  if (!NAMELESS.has(tag)) {
    // why: the name follows the type, which may end on a later line than the tag; after a type, a line left blank moves the name to the next.
    let at = lastTypeLine(lines)
    if (type !== '') while (at < lines.length - 1 && (lines[at] as JsdocLine).tokens.description.trim() === '') at += 1
    const read = readName((lines[at] as JsdocLine).tokens, tag === 'template')
    name = read.name
    optional = read.optional
    defaultValue = read.default
    unpaired = read.unpaired
  }
  return { tag, name, type, optional, default: defaultValue, unpaired, description: joinDescriptions(lines), lines, index }
}

/** A name as read off a tag line. */
interface ReadName {
  /** The name without brackets, quotes or default. */
  readonly name: string
  /** Whether it was bracketed. */
  readonly optional: boolean
  /** The default inside the brackets, or null. */
  readonly default: string | null
  /** Whether brackets were left open. */
  readonly unpaired: boolean
}

/**
 * Reads the type off a tag's lines: braces balanced across lines when they do not close on the
 * first.
 *
 * @param lines - The tag's lines
 * @returns The type without its braces
 */
function readType(lines: JsdocLine[]): string {
  if (!(lines[0] as JsdocLine).tokens.description.startsWith('{')) return ''
  const parts: string[] = []
  let depth = 0
  for (const line of lines) {
    const { tokens } = line
    const close = closingBrace(tokens.description, depth)
    if (close.index === -1) {
      parts.push(tokens.description)
      tokens.type = tokens.description
      tokens.description = ''
      depth = close.depth
      continue
    }
    tokens.type = tokens.description.slice(0, close.index + 1)
    ;[tokens.postType, tokens.description] = splitSpace(tokens.description.slice(close.index + 1))
    parts.push(tokens.type)
    break
  }
  const joined = parts.join('\n')
  return joined.endsWith('}') ? joined.slice(1, -1) : joined.slice(1)
}

/** Where a brace balance closes in a text, or how deep it is left. */
interface BraceClose {
  /** The index of the closing brace, or -1 when the text leaves braces open. */
  readonly index: number
  /** The depth left open at the end of the text. */
  readonly depth: number
}

/**
 * Scans a text for the brace that brings the balance back to zero.
 *
 * @param text - The text scanned
 * @param depth - The depth open before it
 * @returns Where the balance closes, or the depth left
 */
function closingBrace(text: string, depth: number): BraceClose {
  let open = depth
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === '{') open += 1
    else if (text[at] === '}') {
      open -= 1
      if (open === 0) return { index: at, depth: 0 }
    }
  }
  return { index: -1, depth: open }
}

/**
 * Reads the name off a tag's first line: a quoted name, a bracketed optional name with its
 * default, or the first word.
 *
 * @param tokens - The first line's tokens, with the text after the type in `description`
 * @param list - Whether the name may be a comma-separated list, as `@template T, U` writes one
 * @returns What was read
 */
function readName(tokens: JsdocTokens, list: boolean): ReadName {
  const source = tokens.description
  const quoted = source.split('"')
  if (quoted.length > 1 && quoted[0] === '' && quoted.length % 2 === 1) {
    const name = quoted[1] as string
    tokens.name = `"${name}"`
    ;[tokens.postName, tokens.description] = splitSpace(source.slice(tokens.name.length))
    return { name, optional: false, default: null, unpaired: false }
  }
  let depth = 0
  let length = 0
  while (length < source.length) {
    const char = source[length] as string
    // why: in a list, whitespace after a comma continues the name.
    if (depth === 0 && (char === ' ' || char === '\t') && !(list && source.slice(0, length).trimEnd().endsWith(','))) break
    if (char === '[') depth += 1
    if (char === ']') depth -= 1
    length += 1
  }
  // why: brackets left open make no name; the line keeps its text as description.
  if (depth !== 0) return { name: '', optional: false, default: null, unpaired: true }
  const raw = source.slice(0, length)
  tokens.name = raw
  ;[tokens.postName, tokens.description] = splitSpace(source.slice(length))
  if (!(raw.startsWith('[') && raw.endsWith(']'))) return { name: raw, optional: false, default: null, unpaired: false }
  const inner = raw.slice(1, -1)
  const equals = inner.indexOf('=')
  if (equals === -1) return { name: inner.trim(), optional: true, default: null, unpaired: false }
  return { name: inner.slice(0, equals).trim(), optional: true, default: inner.slice(equals + 1).trim(), unpaired: false }
}

/**
 * The description of a tag or a block: its lines' descriptions joined by line feeds, the empty
 * opening and closing lines left out.
 *
 * @param lines - The lines joined
 * @returns The description
 */
function joinDescriptions(lines: readonly JsdocLine[]): string {
  const kept = lines.filter(
    (line, at) =>
      !(
        (at === 0 && line.tokens.delimiter === '/**' && line.tokens.description === '') ||
        (at === lines.length - 1 && line.tokens.end !== '' && line.tokens.description === '')
      )
  )
  return kept
    .slice(lastTypeLine(kept))
    .map((line) => line.tokens.description)
    .join('\n')
}

/**
 * The index of the last line carrying part of a type, where the name and description start.
 *
 * @param lines - The lines searched
 * @returns The index, or 0 when no line carries a type
 */
function lastTypeLine(lines: readonly JsdocLine[]): number {
  let last = 0
  lines.forEach((line, at) => {
    if (line.tokens.type !== '') last = at
  })
  return last
}

/**
 * Whether a line's text opens a tag: `@` followed by a name without whitespace or slash that
 * runs to whitespace or the end, so that a scoped package such as `@scope/name` is text.
 *
 * @param description - The line's text after its delimiter
 * @returns Whether a tag starts on the line
 */
function opensTag(description: string): boolean {
  if (!description.startsWith('@')) return false
  let at = 1
  while (at < description.length && !/[\s/]/.test(description[at] as string)) at += 1
  return at > 1 && (at === description.length || /\s/.test(description[at] as string))
}

/**
 * Parses a JSDoc comment.
 *
 * @param text - The file's text
 * @param start - The offset of `/**`
 * @param end - The offset after `*\/`
 * @param lineStarts - The offsets where the file's lines start, in order
 * @returns The block
 */
export function parseJsdoc(text: string, start: number, end: number, lineStarts: readonly number[]): JsdocBlock {
  let lineIndex = lineStarts.findIndex(
    (offset, at) => offset <= start && (lineStarts[at + 1] === undefined || (lineStarts[at + 1] as number) > start)
  )
  const lineStart = lineStarts[lineIndex] as number
  // why: the text before the comment on its line counts as its indentation, letters replaced by spaces, so that a line added keeps the alignment.
  const indent = text.slice(lineStart, start).replace(/\S/g, ' ')
  // why: a carriage return stays on its line as the line's last token, so the line stringifies back as written.
  const raw = `${indent}${text.slice(start, end)}`.split(/\n/)
  const lines: JsdocLine[] = []
  let offset = lineStart
  raw.forEach((line, at) => {
    lines.push({ offset, number: lineIndex + 1, tokens: lineTokens(line, at === 0) })
    offset += line.length + 1
    lineIndex += 1
  })
  const tags: JsdocTag[] = []
  const descriptionLines: JsdocLine[] = []
  let current: JsdocLine[] | null = null
  let fenced = false
  lines.forEach((line, at) => {
    const { description } = line.tokens
    if (!fenced && opensTag(description)) {
      if (current !== null) tags.push(readTag(current, at - current.length))
      current = [line]
    } else if (current !== null) current.push(line)
    else descriptionLines.push(line)
    // why: inside a code fence, a line starting with `@` is code, such as a decorator, not a tag.
    if (description.split('```').length % 2 === 0) fenced = !fenced
  })
  if (current !== null) tags.push(readTag(current, lines.length - (current as JsdocLine[]).length))
  return { start, end, description: joinDescriptions(descriptionLines), tags, lines }
}

/**
 * A line's text from its tokens.
 *
 * @param tokens - The tokens joined
 * @returns The line, without its line feed
 */
export function stringifyLine(tokens: JsdocTokens): string {
  return `${tokens.start}${tokens.delimiter}${tokens.postDelimiter}${tokens.tag}${tokens.postTag}${tokens.type}${tokens.postType}${tokens.name}${tokens.postName}${tokens.description}${tokens.end}${tokens.lineEnd}`
}
