/**
 * Whether a regular expression takes quadratic time on some input: a pattern that is not anchored
 * at its start is tried again from every position of the subject, so a repetition that can run to
 * the end of a long stretch of characters, and is followed by something that can then fail, reads
 * the stretch once per position. Three things together make it so, and each is decided from the
 * parsed pattern:
 *
 * - a repetition without an upper bound is reached from the start of the pattern with no `^` on
 *   the way, and the pattern is not sticky;
 * - every element the match needs before the repetition can match one character the repetition
 *   repeats, so a stretch of that character starts a match at every position;
 * - what follows the repetition can fail, so the engine gives up and tries the next position.
 *
 * `/\s+$/` and `/0+$/` are reported; `/^\s+$/`, `/,\s*$/` and `/\s+/` are not. Lookarounds,
 * backreferences, word boundaries and repetitions inside other repetitions are left to the
 * star-height check rather than guessed at.
 *
 * @module rules/conventions/shared/polynomial
 */

import type { AlternativeNode, ElementNode, LookaroundNode, QuantifierNode, RegexNode } from '../../../regex/model'
import { visit } from '../../../regex/model'
import { parse } from '../../../regex/parse'

/** Inclusive code point ranges, sorted and merged. */
type Ranges = readonly (readonly [number, number])[]

/** The span of a repetition inside its pattern. */
export interface Span {
  /** The offset of its first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
}

/** The last code point. */
const MAX_CODE_POINT = 0x10ffff

/** Every character. */
const ALL: Ranges = [[0, MAX_CODE_POINT]]

/** What `\d` matches. */
const DIGITS: Ranges = [[0x30, 0x39]]

/** What `\w` matches. */
const WORD: Ranges = [
  [0x30, 0x39],
  [0x41, 0x5a],
  [0x5f, 0x5f],
  [0x61, 0x7a],
]

/** What `\s` matches: the white space and line terminators of the language. */
const SPACE: Ranges = [
  [0x09, 0x0d],
  [0x20, 0x20],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
  [0xfeff, 0xfeff],
]

/** The line terminators, which `.` skips without the `s` flag. */
const LINE_TERMINATORS: Ranges = [
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x2028, 0x2029],
]

/**
 * Sorts ranges and merges those that touch.
 *
 * @param ranges - Any ranges
 * @returns The same characters as sorted, disjoint ranges
 */
function normalize(ranges: readonly (readonly [number, number])[]): Ranges {
  const sorted = [...ranges].sort((left, right) => left[0] - right[0])
  const merged: [number, number][] = []
  for (const [from, to] of sorted) {
    const last = merged[merged.length - 1]
    if (last !== undefined && from <= last[1] + 1) last[1] = to > last[1] ? to : last[1]
    else merged.push([from, to])
  }
  return merged
}

/**
 * The characters both sets hold.
 *
 * @param left - One set
 * @param right - The other
 * @returns Their intersection
 */
function intersect(left: Ranges, right: Ranges): Ranges {
  const shared: [number, number][] = []
  for (const [a, b] of left) {
    for (const [c, d] of right) {
      const from = a > c ? a : c
      const to = b < d ? b : d
      if (from <= to) shared.push([from, to])
    }
  }
  return normalize(shared)
}

/**
 * The characters a set leaves out.
 *
 * @param ranges - The set
 * @returns Every other character
 */
function complement(ranges: Ranges): Ranges {
  const missing: [number, number][] = []
  let next = 0
  for (const [from, to] of ranges) {
    if (from > next) missing.push([next, from - 1])
    next = to + 1
  }
  if (next <= MAX_CODE_POINT) missing.push([next, MAX_CODE_POINT])
  return missing
}

/**
 * A set with the other case of each ASCII letter added, as the `i` flag reads it.
 *
 * @param ranges - The set as written
 * @returns The set the flag matches
 */
function caseFolded(ranges: Ranges): Ranges {
  const upper = intersect(ranges, [[0x41, 0x5a]]).map(([from, to]): [number, number] => [from + 0x20, to + 0x20])
  const lower = intersect(ranges, [[0x61, 0x7a]]).map(([from, to]): [number, number] => [from - 0x20, to - 0x20])
  return normalize([...ranges, ...upper, ...lower])
}

/**
 * The characters a node matching one character matches.
 *
 * @param node - A character, a character set or a class, or one of a class's members
 * @param flags - The pattern's flags
 * @returns The set, or null when the node matches no single character
 */
function charactersOf(node: RegexNode, flags: string): Ranges | null {
  switch (node.kind) {
    case 'Character':
      return flags.includes('i') ? caseFolded([[node.value, node.value]]) : [[node.value, node.value]]
    case 'CharacterClassRange':
      return flags.includes('i') ? caseFolded([[node.from.value, node.to.value]]) : [[node.from.value, node.to.value]]
    case 'CharacterSet': {
      if (node.set === 'any') return flags.includes('s') ? ALL : complement(LINE_TERMINATORS)
      // how: a property escape is taken as matching anything, which can only make a report likelier, never hide one
      const set = node.set === 'digit' ? DIGITS : node.set === 'space' ? SPACE : node.set === 'word' ? WORD : ALL
      return node.negate && node.set !== 'property' ? complement(set) : set
    }
    case 'CharacterClass': {
      // how: every member of a class matches a character, so none answers null
      const members = node.elements.map((element) => charactersOf(element, flags) as Ranges)
      const listed = normalize(members.flat())
      return node.negate ? complement(listed) : listed
    }
    case 'ExpressionCharacterClass':
    case 'ClassStringDisjunction':
      return ALL
    default:
      return null
  }
}

/**
 * Whether an element matches the empty string wherever it is tried, so the match can always step
 * over it.
 *
 * @param element - A term of the pattern, such as a quantifier or a group
 * @returns Whether it always can
 */
function alwaysEmpty(element: ElementNode): boolean {
  if (element.kind === 'Quantifier') return element.min === 0 || alwaysEmpty(element.element)
  if (element.kind === 'Group' || element.kind === 'CapturingGroup')
    return element.alternatives.some((alternative) => alternative.elements.every(alwaysEmpty))
  return false
}

/**
 * The characters a run of which a sequence of elements can match from any position in it: the
 * characters every required element can match.
 *
 * @param elements - The sequence
 * @param flags - The pattern's flags
 * @param seed - The characters the run is drawn from so far
 * @returns The characters still possible, or null when no run can match the sequence
 */
function runOf(elements: readonly ElementNode[], flags: string, seed: Ranges): Ranges | null {
  let run = seed
  for (const element of elements) {
    if (alwaysEmpty(element)) continue
    const own = elementRun(element, flags)
    if (own === null) return null
    run = intersect(run, own)
    if (run.length === 0) return null
  }
  return run
}

/**
 * The characters a run of which an element matches.
 *
 * @param element - A term of the pattern a run might be matched against
 * @param flags - The pattern's flags
 * @returns The characters, or null for an assertion, a lookaround, a backreference or an element no run matches
 */
function elementRun(element: ElementNode, flags: string): Ranges | null {
  if (element.kind === 'Quantifier') return elementRun(element.element, flags)
  if (element.kind === 'Group' || element.kind === 'CapturingGroup') {
    const runs = element.alternatives.map((alternative) => runOf(alternative.elements, flags, ALL)).filter((run) => run !== null)
    return runs.length === 0 ? null : normalize(runs.flat())
  }
  return charactersOf(element, flags)
}

/**
 * The characters the alternatives of a lookaround can start with.
 *
 * @param alternatives - The lookaround's alternatives
 * @param flags - The pattern's flags
 * @returns The characters, or null when an alternative can match the empty string or starts with something other than a character
 */
function firstCharacters(alternatives: readonly AlternativeNode[], flags: string): Ranges | null {
  const sets: Ranges[] = []
  for (const alternative of alternatives) {
    const required = alternative.elements.findIndex((element) => !alwaysEmpty(element))
    if (required === -1) return null
    for (const element of alternative.elements.slice(0, required + 1)) {
      const own = charactersOf(element.kind === 'Quantifier' ? element.element : element, flags)
      if (own === null) return null
      sets.push(own)
    }
  }
  return normalize(sets.flat())
}

/**
 * Whether a negative lookahead after a repetition never makes the match fail for good: where it
 * starts with nothing the repetition repeats, giving back one character satisfies it, and where it
 * starts with nothing else, the character that ends the stretch never matches it.
 *
 * @param lookaround - A lookaround following the repetition
 * @param repeated - The characters the repetition repeats
 * @param flags - The pattern's flags
 * @returns Whether it always passes once the repetition has backed off
 */
function passesAfterBackOff(lookaround: LookaroundNode, repeated: Ranges, flags: string): boolean {
  if (lookaround.behind || !lookaround.negate) return false
  const first = firstCharacters(lookaround.alternatives, flags)
  return first !== null && (intersect(first, repeated).length === 0 || intersect(first, complement(repeated)).length === 0)
}

/**
 * Whether a repetition reads a stretch of the subject once for every position in it.
 *
 * @param quantifier - A repetition without an upper bound
 * @param flags - The pattern's flags
 * @returns Whether it does
 */
function isPolynomial(quantifier: QuantifierNode, flags: string): boolean {
  const repeated = elementRun(quantifier.element, flags)
  if (repeated === null) return false
  const before: ElementNode[] = []
  const after: ElementNode[] = []
  let node: RegexNode = quantifier
  for (let parent = node.parent; parent !== null && parent.kind !== 'Pattern'; parent = parent.parent) {
    if (parent.kind === 'Alternative') {
      const at = parent.elements.indexOf(node as ElementNode)
      before.push(...parent.elements.slice(0, at))
      after.push(...parent.elements.slice(at + 1))
    } else if (parent.kind !== 'Group' && parent.kind !== 'CapturingGroup') return false
    node = parent
  }
  if (runOf(before, flags, repeated) === null) return false
  const required = after.filter(
    (element) => !alwaysEmpty(element) && !(element.kind === 'Lookaround' && passesAfterBackOff(element, repeated, flags))
  )
  if (required.length === 0) return false
  // why: an end assertion after a repetition of every character, or of every character but the line terminators under the `m` flag, always matches where the repetition stops
  const unmatched = complement(repeated)
  const onlyEnds = required.every((element) => element.kind === 'Assertion' && element.assertion === 'end')
  return !(onlyEnds && (unmatched.length === 0 || (flags.includes('m') && intersect(unmatched, complement(LINE_TERMINATORS)).length === 0)))
}

/**
 * The first repetition of a pattern that takes quadratic time on some input.
 *
 * @param pattern - The source of a regular expression
 * @param flags - Its flags
 * @returns The repetition's span in the pattern, or null when there is none or the pattern does not parse
 *
 * @example A trailing-space trim and its anchored form
 * ```typescript
 * polynomialRepetition('\\s+$', '') // => { start: 0, end: 3 }
 * polynomialRepetition('^\\s+$', '') // => null
 * ```
 */
export function polynomialRepetition(pattern: string, flags: string): Span | null {
  const tree = parse(pattern, flags).pattern
  if (tree === null || flags.includes('y')) return null
  let found: Span | null = null
  visit(tree, (node) => {
    if (found === null && node.kind === 'Quantifier' && node.max === Infinity && isPolynomial(node, flags))
      found = { start: node.start, end: node.end }
  })
  return found
}
