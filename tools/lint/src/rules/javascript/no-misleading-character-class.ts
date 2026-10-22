/**
 * A character class lists single characters, so a surrogate pair without the `u` flag, a
 * character followed by a combining mark, an emoji with a modifier, a flag of two regional
 * indicators or a sequence joined with zero-width joiners does not match what was written. Each
 * is reported where it stands, in a literal or in the string a `RegExp` call is given.
 *
 * @module rules/javascript/no-misleading-character-class
 */

import type { Node } from '../../code/model.ts'
import type { CharacterNode, ClassElementNode } from '../../regex/model.ts'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { fromCodePoint } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'
import { defineRule } from '../../engine/rule.ts'
import { visit } from '../../regex/model.ts'
import { parse } from '../../regex/parse.ts'
import { isDigit, isOctalDigit } from '../../regex/reader.ts'
import { scopeAnalysisOf } from '../../scope/analysis.ts'
import { constantString, isRegExpReference } from './shared/regexp-construction.ts'

/** A span of the source. */
interface Span {
  /** The first offset. */
  readonly start: number
  /** The offset after the last. */
  readonly end: number
}

/** Maps a span of the pattern to a span of the source. */
type Locator = (start: number, end: number) => Span

/** Finds the sequences of a kind among the characters of a class, each as the characters it spans. */
type Finder = (chars: readonly CharacterNode[]) => CharacterNode[][]

/** One kind of misleading sequence. */
interface Check {
  /** What is reported. */
  readonly message: string
  /** How the sequences are found. */
  readonly find: Finder
}

/** How many code units an escape yields and how many characters it spans. */
interface EscapeShape {
  /** The code units in the value. */
  readonly units: number
  /** The characters in the source. */
  readonly width: number
}

/** The zero-width joiner. */
const ZERO_WIDTH_JOINER = 0x200d

/** The combining marks. */
const COMBINING = /^[\p{Mc}\p{Me}\p{Mn}]$/u

/** The line terminators a backslash may precede to continue a string. */
const LINE_TERMINATORS = createSet(['\n', ' ', ' '])

/**
 * Whether a character is written as a `\u{...}` escape.
 *
 * @param node - The character
 * @returns True for a code point escape
 */
function isCodePointEscape(node: CharacterNode): boolean {
  return node.raw.startsWith('\\u{')
}

/**
 * Whether two characters are a lead and a trail surrogate.
 *
 * @param previous - The first
 * @param char - The second
 * @returns True for a surrogate pair
 */
function isSurrogatePair(previous: CharacterNode, char: CharacterNode): boolean {
  return previous.value >= 0xd800 && previous.value <= 0xdbff && char.value >= 0xdc00 && char.value <= 0xdfff
}

/**
 * Whether a character is a combining mark.
 *
 * @param node - The character
 * @returns True for a mark
 */
function isCombining(node: CharacterNode): boolean {
  return COMBINING.test(fromCodePoint(node.value))
}

/**
 * Whether a character is an emoji modifier.
 *
 * @param node - The character
 * @returns True for a skin tone modifier
 */
function isEmojiModifier(node: CharacterNode): boolean {
  return node.value >= 0x1f3fb && node.value <= 0x1f3ff
}

/**
 * Whether a character is a regional indicator symbol.
 *
 * @param node - The character
 * @returns True for a regional indicator
 */
function isRegionalIndicator(node: CharacterNode): boolean {
  return node.value >= 0x1f1e6 && node.value <= 0x1f1ff
}

/**
 * The consecutive pairs of characters a test picks.
 *
 * @param chars - The characters of a sequence
 * @param test - What a pair must satisfy
 * @returns The pairs, each the two characters in order
 */
function pairs(chars: readonly CharacterNode[], test: (previous: CharacterNode, char: CharacterNode) => boolean): CharacterNode[][] {
  const found: CharacterNode[][] = []
  for (let index = 1; index < chars.length; index += 1) {
    const previous = chars[index - 1] as CharacterNode
    const char = chars[index] as CharacterNode
    if (test(previous, char)) found.push([previous, char])
  }
  return found
}

/**
 * The sequences joined with zero-width joiners, each a run of characters alternating with joiners.
 *
 * @param chars - The characters of a sequence
 * @returns The joined sequences, each from its first character to its last
 */
function joinedSequences(chars: readonly CharacterNode[]): CharacterNode[][] {
  const found: CharacterNode[][] = []
  let sequence: CharacterNode[] | null = null
  for (let index = 1; index < chars.length - 1; index += 1) {
    const char = chars[index] as CharacterNode
    const previous = chars[index - 1] as CharacterNode
    const next = chars[index + 1] as CharacterNode
    if (char.value !== ZERO_WIDTH_JOINER || previous.value === ZERO_WIDTH_JOINER || next.value === ZERO_WIDTH_JOINER) continue
    if (sequence !== null && sequence[sequence.length - 1] === previous) {
      sequence.push(char, next)
      continue
    }
    if (sequence !== null) found.push(sequence)
    sequence = [previous, char, next]
  }
  if (sequence !== null) found.push(sequence)
  return found
}

/** The kinds of misleading sequence, in the order they are reported. */
const CHECKS: readonly Check[] = [
  {
    message: "Unexpected surrogate pair in character class. Use 'u' flag.",
    find: (chars) =>
      pairs(chars, (previous, char) => isSurrogatePair(previous, char) && !isCodePointEscape(previous) && !isCodePointEscape(char)),
  },
  {
    message: 'Unexpected surrogate pair in character class.',
    find: (chars) =>
      pairs(chars, (previous, char) => isSurrogatePair(previous, char) && (isCodePointEscape(previous) || isCodePointEscape(char))),
  },
  {
    message: 'Unexpected combined character in character class.',
    find: (chars) => pairs(chars, (previous, char) => isCombining(char) && !isCombining(previous)),
  },
  {
    message: 'Unexpected modified Emoji in character class.',
    find: (chars) => pairs(chars, (previous, char) => isEmojiModifier(char) && !isEmojiModifier(previous)),
  },
  {
    message: 'Unexpected national flag in character class.',
    find: (chars) => pairs(chars, (previous, char) => isRegionalIndicator(char) && isRegionalIndicator(previous)),
  },
  { message: 'Unexpected joined character sequence in character class.', find: joinedSequences },
]

/**
 * The runs of characters a class lists one after another; a range contributes its ends to the
 * runs around it, and anything else breaks the run.
 *
 * @param elements - The class's elements
 * @returns The runs
 */
function sequencesOf(elements: readonly ClassElementNode[]): CharacterNode[][] {
  const sequences: CharacterNode[][] = []
  let current: CharacterNode[] = []
  for (const element of elements) {
    if (element.kind === 'Character') {
      current.push(element)
    } else if (element.kind === 'CharacterClassRange') {
      current.push(element.from)
      sequences.push(current)
      current = [element.to]
    } else if (current.length > 0) {
      sequences.push(current)
      current = []
    }
  }
  if (current.length > 0) sequences.push(current)
  return sequences
}

/**
 * How many code units the escape at an offset of a string's text yields and how many characters it spans.
 *
 * @param raw - The text between the delimiters
 * @param index - The offset of the backslash
 * @param template - Whether the text is a template's, which knows no legacy octal escape
 * @returns How many units it yields and how many characters it spans
 */
function escapeShape(raw: string, index: number, template: boolean): EscapeShape {
  const next = raw[index + 1] as string
  if (next === '\r') return { units: 0, width: raw[index + 2] === '\n' ? 3 : 2 }
  if (LINE_TERMINATORS.has(next)) return { units: 0, width: 2 }
  if (next === 'x') return { units: 1, width: 4 }
  if (next === 'u') {
    if (raw[index + 2] !== '{') return { units: 1, width: 6 }
    const close = raw.indexOf('}', index)
    return { units: parseInt(raw.slice(index + 3, close), 16) > 0xffff ? 2 : 1, width: close - index + 1 }
  }
  if (!template && isDigit(next)) {
    let width = 2
    if (isOctalDigit(next) && isOctalDigit(raw[index + 2] as string)) {
      width += 1
      if (next <= '3' && isOctalDigit(raw[index + 3] as string)) width += 1
    }
    return { units: 1, width }
  }
  const length = fromCodePoint(raw.codePointAt(index + 1) as number).length
  return { units: length, width: 1 + length }
}

/**
 * The source offset each code unit of a string's value starts at, followed by the offset after
 * the text.
 *
 * @param raw - The text between the delimiters
 * @param base - The source offset the text starts at
 * @param template - Whether the text is a template's, where a CR LF is one unit
 * @returns The offsets, one per unit and one more
 */
function valueOffsets(raw: string, base: number, template: boolean): number[] {
  const offsets: number[] = []
  let index = 0
  while (index < raw.length) {
    const char = raw[index] as string
    if (char === '\\') {
      const shape = escapeShape(raw, index, template)
      for (let unit = 0; unit < shape.units; unit += 1) offsets.push(base + index)
      index += shape.width
      continue
    }
    offsets.push(base + index)
    index += template && char === '\r' && raw[index + 1] === '\n' ? 2 : 1
  }
  offsets.push(base + raw.length)
  return offsets
}

export default defineRule<undefined, Node>({
  id: 'no-misleading-character-class',
  language: 'code',
  fixable: false,
  create(context) {
    const reported = createSet<string>()
    const report = (message: string, span: Span): void => {
      // why: a regular expression literal handed to `RegExp` is checked under its own flags and under the call's; one finding is enough.
      const key = `${message}@${span.start}-${span.end}`
      if (reported.has(key)) return
      reported.add(key)
      context.report({ start: span.start, end: span.end, message })
    }
    const check = (target: Node, pattern: string, flags: string, locate: Locator | null): void => {
      const parsed = parse(pattern, flags).pattern
      if (parsed === null) return
      const matches: CharacterNode[][][] = CHECKS.map(() => [])
      visit(parsed, (item) => {
        if (item.kind !== 'CharacterClass') return
        for (const sequence of sequencesOf(item.elements)) {
          CHECKS.forEach((item2, index) => (matches[index] as CharacterNode[][]).push(...item2.find(sequence)))
        }
      })
      CHECKS.forEach((item, index) => {
        for (const match of matches[index] as CharacterNode[][]) {
          const first = match[0] as CharacterNode
          const last = match[match.length - 1] as CharacterNode
          report(item.message, locate === null ? target : locate(first.start, last.end))
        }
      })
    }
    const literalLocator =
      (node: Node): Locator =>
      (start, end) => ({ start: node.start + 1 + start, end: node.start + 1 + end })
    const stringLocator = (node: Node): Locator | null => {
      const template = node.kind === 'TemplateLiteral' && (node.expressions as readonly Node[]).length === 0
      if (!template && typeof node.value !== 'string') return null
      const base = node.start + 1
      const offsets = valueOffsets(context.file.text.slice(base, node.end - 1), base, template)
      return (start, end) => ({ start: offsets[start] as number, end: offsets[end] as number })
    }
    const call = (node: Node): void => {
      const analysis = scopeAnalysisOf(context)
      if (!isRegExpReference(analysis, node.callee as Node)) return
      const [first, second] = node.arguments as readonly Node[]
      if (first === undefined) return
      const flags = second === undefined ? null : constantString(analysis, second)
      if (second !== undefined && flags === null) return
      if (first.regex !== undefined) {
        check(first, first.regex.pattern, flags ?? first.regex.flags, literalLocator(first))
        return
      }
      const pattern = constantString(analysis, first)
      if (pattern !== null) check(first, pattern, flags ?? '', stringLocator(first))
    }
    return {
      Literal(node) {
        if (node.regex !== undefined) check(node, node.regex.pattern, node.regex.flags, literalLocator(node))
      },
      CallExpression: call,
      NewExpression: call,
    }
  },
})
