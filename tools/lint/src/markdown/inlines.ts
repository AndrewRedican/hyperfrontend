/**
 * The inline content of a block: code spans, escapes, entities, line breaks, raw HTML,
 * autolinks, links and images by destination or reference, footnote references, and the
 * delimiter runs emphasis is resolved from.
 *
 * @module markdown/inlines
 */

import type { Segment } from './blocks.ts'
import type { Definition } from './definitions.ts'
import type { Content, Item } from './items.ts'
import type { MarkdownNode, MarkdownPoint } from './model.ts'
import { labelEnd, normaliseLabel, takeDestination, takeTitle } from './definitions.ts'
import { resolveEmphasis } from './emphasis.ts'
import { decodeText, entityAt, isAsciiPunctuation } from './entities.ts'
import { contentOf, item } from './items.ts'
import { closingTagEnd, domainEnd, localPartEnd, openTagEnd } from './scanners.ts'

/** Where references resolve. */
export interface References {
  /** The link definitions by identifier. */
  readonly definitions: ReadonlyMap<string, Definition>
  /** The footnote identifiers defined. */
  readonly footnotes: ReadonlySet<string>
  /** Whether the content is a table cell, where an escaped pipe is a pipe even in code. */
  readonly cell: boolean
}

/** The forms of raw inline HTML other than tags: comments, processing instructions, declarations, character data. */
const HTML_FORMS = [/^<!--->|^<!-->|^<!--[\s\S]*?-->/, /^<\?[\s\S]*?\?>/, /^<![A-Za-z][\s\S]*?>/, /^<!\[CDATA\[[\s\S]*?\]\]>/]

/** An autolink in angle brackets holding a URI. */
const AUTOLINK_URI = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>/

/** A bare URL's text with the index after it. */
interface Literal {
  /** The content index after the URL. */
  readonly end: number
  /** The target, with a scheme added to a `www.` form. */
  readonly url: string
}

/** A code span's value with the index after it. */
interface CodeSpan {
  /** The content index after the closing run. */
  readonly end: number
  /** The code, stripped of one surrounding space when both sides have one. */
  readonly value: string
}

// why: the start and end of content count as whitespace for flanking.
const isWhitespace = (char: string | undefined): boolean => char === undefined || /\s/.test(char)

// why: Unicode punctuation and symbols both count as punctuation for flanking.
const isPunctuation = (char: string | undefined): boolean => char !== undefined && /[\p{P}\p{S}]/u.test(char)

/**
 * The email address at an offset, as an autolink or a bare address holds one: a local part,
 * `@`, and a domain.
 *
 * @param text - The content
 * @param at - Where the local part would start
 * @returns The index after the domain, or -1
 */
function emailEnd(text: string, at: number): number {
  const local = localPartEnd(text, at)
  if (local === -1 || text[local] !== '@') return -1
  return domainEnd(text, local + 1)
}

/**
 * The bare URL at an index, as the GitHub flavour reads it: `www.` or an HTTP scheme, a domain
 * with a dot, a path up to whitespace, trailing punctuation left out.
 *
 * @param text - The content
 * @param at - Where the URL would start
 * @returns The URL's text with the index after it, or null
 */
function autolinkLiteral(text: string, at: number): Literal | null {
  const before = text[at - 1]
  const scheme = /^(https?:\/\/|www\.)/i.exec(text.slice(at, at + 8))
  if (scheme === null) return null
  const www = scheme[0].toLowerCase().startsWith('www')
  if (www ? !(before === undefined || isWhitespace(before) || '*_[]~('.includes(before)) : before !== undefined && /[A-Za-z]/.test(before))
    return null
  const domainAt = at + scheme[0].length
  let end = domainEnd(text, domainAt)
  if (end === -1) return null
  const domain = text.slice(domainAt, end)
  if (
    !domain.includes('.') ||
    domain
      .split('.')
      .slice(-2)
      .some((part) => part.includes('_'))
  )
    return null
  while (end < text.length && !isWhitespace(text[end]) && text[end] !== '<') end += 1
  for (;;) {
    const last = text[end - 1]
    const entity = last === ';' ? /&[A-Za-z0-9]+;$/.exec(text.slice(at, end)) : null
    if (entity !== null) end -= entity[0].length
    else if (last === ')' && text.slice(at, end).split(')').length > text.slice(at, end).split('(').length) end -= 1
    else if (last !== ')' && '!"&\',*.:;<?]_~'.includes(last)) end -= 1
    else break
  }
  const written = text.slice(at, end)
  return { end, url: www ? `http://${written}` : written }
}

/**
 * The bare email address at an index, linked as `mailto:`.
 *
 * @param text - The content
 * @param at - Where the address would start
 * @returns The index after it, or null
 */
function emailLiteral(text: string, at: number): number | null {
  const before = text[at - 1]
  if (before !== undefined && /[A-Za-z0-9._+/-]/.test(before)) return null
  const end = emailEnd(text, at)
  if (end === -1) return null
  const domain = text.slice(text.indexOf('@', at) + 1, end)
  return domain.includes('.') && /[A-Za-z]$/.test(domain) ? end : null
}

/**
 * The code span at an index.
 *
 * @param text - The content
 * @param at - The first backtick
 * @returns The span's value and end, or null when its run never closes
 */
function codeSpan(text: string, at: number): CodeSpan | null {
  let run = 0
  while (text[at + run] === '`') run += 1
  let index = at + run
  while (index < text.length) {
    if (text[index] !== '`') {
      index += 1
      continue
    }
    let closing = 0
    while (text[index + closing] === '`') closing += 1
    if (closing === run) {
      let value = text.slice(at + run, index)
      if (value.length > 1 && /^[ \n]/.test(value) && /[ \n]$/.test(value) && value.trim() !== '') value = value.slice(1, -1)
      return { end: index + closing, value }
    }
    index += closing
  }
  return null
}

/**
 * The length of the line ending at an index: two for a carriage return and line feed, one for a
 * line feed, zero for anything else.
 *
 * @param text - The content
 * @param at - The index
 * @returns The length
 */
function lineEndingAt(text: string, at: number): number {
  if (text[at] === '\n') return 1
  return text[at] === '\r' && text[at + 1] === '\n' ? 2 : 0
}

/**
 * The plain text of pieces, as an image's alternative text.
 *
 * @param items - The pieces
 * @returns Their text, code included
 */
function plainText(items: readonly Item[]): string {
  return items.map((piece) => (piece.kind === 'text' || piece.kind === 'inlineCode' ? piece.value : plainText(piece.children))).join('')
}

/**
 * Tokenises a content string and resolves its brackets and emphasis.
 *
 * @param text - The content
 * @param references - Where references resolve
 * @returns The pieces, in order
 */
function tokenise(text: string, references: References): Item[] {
  const items: Item[] = []
  const brackets: number[] = []
  let textStart = 0
  let buffer = ''
  const flush = (end: number): void => {
    if (buffer !== '') {
      const piece = item('text', textStart, end)
      piece.value = buffer
      items.push(piece)
    }
    buffer = ''
    textStart = end
  }
  const push = (piece: Item): void => {
    flush(piece.start)
    items.push(piece)
    textStart = piece.end
  }
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '\\') {
      const ending = lineEndingAt(text, index + 1)
      if (ending !== 0) {
        push(item('break', index, index + 1 + ending))
        index += 1 + ending
      } else if (isAsciiPunctuation(text[index + 1])) {
        buffer += text[index + 1]
        index += 2
      } else {
        buffer += char
        index += 1
      }
      continue
    }
    if (char === '&') {
      const entity = entityAt(text, index)
      buffer += entity === null ? char : entity.value
      index = entity === null ? index + 1 : entity.end
      continue
    }
    if (char === '`') {
      const span = codeSpan(text, index)
      if (span === null) {
        let run = 0
        while (text[index + run] === '`') run += 1
        buffer += text.slice(index, index + run)
        index += run
      } else {
        const piece = item('inlineCode', index, span.end)
        piece.value = references.cell ? span.value.replace(/\\\|/g, '|') : span.value
        push(piece)
        index = span.end
      }
      continue
    }
    if (char === '<') {
      const rest = text.slice(index)
      const uri = AUTOLINK_URI.exec(rest)
      const email = uri === null ? emailEnd(text, index + 1) : -1
      const autoEnd = uri === null ? (email !== -1 && text[email] === '>' ? email + 1 : -1) : index + uri[0].length
      if (autoEnd !== -1) {
        const address = text.slice(index + 1, autoEnd - 1)
        const piece = item('link', index, autoEnd)
        piece.url = uri === null ? `mailto:${address}` : address
        const inner = item('text', index + 1, autoEnd - 1)
        inner.value = address
        piece.children = [inner]
        push(piece)
        index = autoEnd
        continue
      }
      const tagEnd = text[index + 1] === '/' ? closingTagEnd(text, index) : openTagEnd(text, index)
      const form = tagEnd === -1 ? HTML_FORMS.map((candidate) => candidate.exec(rest)).find((match) => match !== null) : undefined
      const htmlEnd = tagEnd !== -1 ? tagEnd : form === undefined || form === null ? -1 : index + form[0].length
      if (htmlEnd !== -1) {
        const piece = item('html', index, htmlEnd)
        piece.value = text.slice(index, htmlEnd)
        push(piece)
        index = htmlEnd
        continue
      }
    }
    if (char === '!' && text[index + 1] === '[') {
      const piece = item('bracket', index, index + 2)
      piece.image = true
      push(piece)
      brackets.push(items.length - 1)
      index += 2
      continue
    }
    if (char === '[') {
      const footnote = text[index + 1] === '^' ? /^\[\^([^\s[\]]+)\]/.exec(text.slice(index)) : null
      if (footnote !== null && references.footnotes.has(normaliseLabel(footnote[1]))) {
        const piece = item('footnoteReference', index, index + footnote[0].length)
        piece.identifier = normaliseLabel(footnote[1])
        push(piece)
        index += footnote[0].length
        continue
      }
      push(item('bracket', index, index + 1))
      brackets.push(items.length - 1)
      index += 1
      continue
    }
    if (char === ']') {
      const opened = brackets.pop()
      const link = opened === undefined || !items[opened].active ? null : closeBracket(text, index, items, opened, references)
      if (link === null) {
        if (opened !== undefined && brackets.length === 0) {
          flush(index)
          relink(items, opened + 1, text)
        }
        buffer += char
        index += 1
        continue
      }
      flush(index)
      const opener = items[opened as number]
      if (!opener.image) for (const piece of items.slice(0, opened)) if (piece.kind === 'bracket' && !piece.image) piece.active = false
      const inner = items.splice((opened as number) + 1)
      items.pop()
      resolveEmphasis(inner)
      link.children = inner
      link.start = opener.start
      if (opener.image) link.value = plainText(inner)
      items.push(link)
      while (brackets.length > 0 && brackets[brackets.length - 1] > (opened as number)) brackets.pop()
      textStart = link.end
      index = link.end
      continue
    }
    if (char === '*' || char === '_' || char === '~') {
      let run = 0
      while (text[index + run] === char) run += 1
      if (char === '~' && run > 2) {
        buffer += text.slice(index, index + run)
        index += run
        continue
      }
      const before = text[index - 1]
      const after = text[index + run]
      const left = !isWhitespace(after) && (!isPunctuation(after) || isWhitespace(before) || isPunctuation(before))
      const right = !isWhitespace(before) && (!isPunctuation(before) || isWhitespace(after) || isPunctuation(after))
      const piece = item('delimiter', index, index + run)
      piece.char = char
      piece.count = run
      piece.originalCount = run
      piece.canOpen = char === '_' ? left && (!right || isPunctuation(before)) : left
      piece.canClose = char === '_' ? right && (!left || isPunctuation(after)) : right
      push(piece)
      index += run
      continue
    }
    if (char === ' ' || char === '\t') {
      let run = 0
      while (text[index + run] === ' ' || text[index + run] === '\t') run += 1
      if (index + run >= text.length) {
        flush(index)
        break
      }
      const ending = lineEndingAt(text, index + run)
      if (ending !== 0) {
        if (run >= 2) push(item('break', index, index + run + ending))
        else buffer += text.slice(index + run, index + run + ending)
        index += run + ending
        continue
      }
      buffer += text.slice(index, index + run)
      index += run
      continue
    }
    if (brackets.length === 0 && /[A-Za-z0-9]/.test(char)) {
      const literal = /[hHwW]/.test(char) ? autolinkLiteral(text, index) : null
      const email = literal === null ? emailLiteral(text, index) : null
      const end = literal === null ? email : literal.end
      if (end !== null) {
        const piece = item('link', index, end)
        piece.url = literal === null ? `mailto:${text.slice(index, end)}` : literal.url
        const inner = item('text', index, end)
        inner.value = text.slice(index, end)
        piece.children = [inner]
        push(piece)
        index = end
        continue
      }
    }
    buffer += char
    index += 1
  }
  flush(text.length)
  if (brackets.length > 0) relink(items, brackets[0] + 1, text)
  resolveEmphasis(items)
  return items
}

/**
 * Finds the bare URLs and addresses in the text pieces after a bracket that formed no link,
 * where they were skipped while the bracket was open.
 *
 * @param items - The pieces
 * @param from - The index of the first piece after the opener
 * @param text - The content
 */
function relink(items: Item[], from: number, text: string): void {
  for (let index = from; index < items.length; index += 1) {
    const piece = items[index]
    if (piece.kind !== 'text') continue
    const replacement: Item[] = []
    let at = piece.start
    let textStart = piece.start
    while (at < piece.end) {
      const literal = /[hHwW]/.test(text[at]) ? autolinkLiteral(text, at) : null
      const email = literal === null && /[A-Za-z0-9]/.test(text[at]) ? emailLiteral(text, at) : null
      const end = literal === null ? email : literal.end
      if (end === null || end > piece.end) {
        at += 1
        continue
      }
      if (at > textStart) {
        const before = item('text', textStart, at)
        before.value = decodeText(text.slice(textStart, at))
        replacement.push(before)
      }
      const link = item('link', at, end)
      link.url = literal === null ? `mailto:${text.slice(at, end)}` : literal.url
      const inner = item('text', at, end)
      inner.value = text.slice(at, end)
      link.children = [inner]
      replacement.push(link)
      at = end
      textStart = end
    }
    if (replacement.length === 0) continue
    if (textStart < piece.end) {
      const after = item('text', textStart, piece.end)
      after.value = decodeText(text.slice(textStart, piece.end))
      replacement.push(after)
    }
    items.splice(index, 1, ...replacement)
    index += replacement.length - 1
  }
}

/**
 * The link or image a closing bracket completes, when it does.
 *
 * @param text - The content
 * @param at - The closing bracket
 * @param items - The pieces so far
 * @param opened - The index of the opener among them
 * @param references - Where references resolve
 * @returns The piece with its target, children unset, or null
 */
function closeBracket(text: string, at: number, items: readonly Item[], opened: number, references: References): Item | null {
  const opener = items[opened]
  const kind = opener.image ? 'image' : 'link'
  if (text[at + 1] === '(') {
    let index = at + 2
    while (index < text.length && /\s/.test(text[index])) index += 1
    const destination = text[index] === ')' ? null : takeDestination(text, index, text.length)
    let end = destination === null ? index : destination.end
    let title: string | null = null
    let after = end
    while (after < text.length && /\s/.test(text[after])) after += 1
    if (after > end && text[after] !== ')') {
      const taken = takeTitle(text, after, text.length)
      if (taken !== null) {
        title = taken.value
        end = taken.end
        after = end
        while (after < text.length && /\s/.test(text[after])) after += 1
      }
    }
    if (text[after] === ')') {
      const piece = item(kind, opener.start, after + 1)
      piece.url = destination === null ? '' : destination.value
      piece.title = title
      return piece
    }
  }
  const inner = text.slice(opener.end, at)
  if (text[at + 1] === '[') {
    const end = text[at + 2] === ']' ? at + 3 : labelEnd(text, at + 1)
    const label = end === -1 ? null : normaliseLabel(text[at + 2] === ']' ? inner : text.slice(at + 2, end - 1))
    if (label !== null && references.definitions.has(label)) {
      const piece = item(`${kind}Reference`, opener.start, end)
      piece.identifier = label
      return piece
    }
  }
  const shortcut = normaliseLabel(inner)
  if (shortcut === '' || !references.definitions.has(shortcut) || /(^|[^\\])[[\]]/.test(inner)) return null
  const piece = item(`${kind}Reference`, opener.start, at + 1)
  piece.identifier = shortcut
  return piece
}

/**
 * The nodes of resolved pieces, adjacent text merged.
 *
 * @param items - The pieces
 * @param content - The content they index
 * @param point - The point of a source offset
 * @returns The nodes in order
 */
function toNodes(items: readonly Item[], content: Content, point: (offset: number) => MarkdownPoint): MarkdownNode[] {
  const nodes: MarkdownNode[] = []
  const position = (start: number, end: number): MarkdownNode['position'] => ({
    start: point(content.sourceAt(start)),
    end: point(content.sourceAt(end, true)),
  })
  let index = 0
  while (index < items.length) {
    const piece = items[index]
    if (piece.kind === 'text') {
      let end = index
      let value = ''
      while (end < items.length && items[end].kind === 'text') {
        value += items[end].value
        end += 1
      }
      nodes.push({ kind: 'text', position: position(piece.start, items[end - 1].end), value })
      index = end
      continue
    }
    index += 1
    const where = position(piece.start, piece.end)
    switch (piece.kind) {
      case 'inlineCode':
      case 'html':
        nodes.push({ kind: piece.kind, position: where, value: piece.value })
        break
      case 'break':
        nodes.push({ kind: 'break', position: where })
        break
      case 'footnoteReference':
        nodes.push({ kind: 'footnoteReference', position: where, identifier: piece.identifier })
        break
      case 'link':
      case 'image': {
        const node: MarkdownNode = {
          kind: piece.kind,
          position: where,
          url: piece.url,
          ...(piece.title === null ? {} : { title: piece.title }),
        }
        nodes.push(piece.kind === 'image' ? { ...node, alt: piece.value } : { ...node, children: toNodes(piece.children, content, point) })
        break
      }
      case 'linkReference':
      case 'imageReference':
        nodes.push({
          kind: piece.kind,
          position: where,
          identifier: piece.identifier,
          ...(piece.kind === 'imageReference' ? { alt: plainText(piece.children) } : { children: toNodes(piece.children, content, point) }),
        })
        break
      default:
        nodes.push({
          kind: piece.kind as 'emphasis' | 'strong' | 'delete',
          position: where,
          children: toNodes(piece.children, content, point),
        })
    }
  }
  return nodes
}

/**
 * Parses the inline content of a block.
 *
 * @param text - The document
 * @param segments - The block's content lines
 * @param references - Where references resolve, and whether the block is a table cell
 * @param point - The point of a source offset
 * @returns The inline nodes
 */
export function parseInlines(
  text: string,
  segments: readonly Segment[],
  references: References,
  point: (offset: number) => MarkdownPoint
): MarkdownNode[] {
  if (segments.length === 0) return []
  const content = contentOf(text, segments)
  return toNodes(tokenise(content.text, references), content, point)
}
