/**
 * Parses a regular expression pattern under its flags into the tree of `regex/model`, in the
 * grammar the flags select: the strict one under `u` or `v`, otherwise the legacy one that reads
 * a lone bracket as a character, takes octal escapes and lets a backslash precede almost any
 * character. An invalid pattern yields an error with its position rather than an exception.
 *
 * @module regex/parse
 */

import type {
  AlternativeNode,
  AssertionKind,
  AssertionNode,
  BackreferenceNode,
  CapturingGroupNode,
  ElementNode,
  GroupNode,
  LookaroundNode,
  ParseResult,
  PatternNode,
  QuantifierNode,
  RegexNode,
} from './model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readCharacterClass } from './classes'
import { characterSetNode, readCharacterEscape, readClassEscape, readGroupName } from './escapes'
import { PatternFailure, PatternReader, codePointOf, isDigit } from './reader'

/** A node that holds alternatives. */
type DisjunctionNode = PatternNode | GroupNode | CapturingGroupNode | LookaroundNode

/** How often a quantifier repeats its term. */
interface Bounds {
  /** The least repetitions. */
  readonly min: number
  /** The most repetitions, infinite when unbounded. */
  readonly max: number
}

/** What a scan of the whole pattern finds about its capturing groups before they are parsed. */
interface GroupScan {
  /** How many capturing groups the pattern opens. */
  readonly count: number
  /** Whether any of them is named. */
  readonly named: boolean
}

/**
 * Counts the capturing groups of a pattern and notes whether any is named, which the grammar
 * needs before it reads a backreference.
 *
 * @param source - The pattern text
 * @returns The count and whether a name was seen
 */
function scanGroups(source: string): GroupScan {
  let count = 0
  let named = false
  let inClass = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '\\') index += 1
    else if (char === '[') inClass = true
    else if (char === ']') inClass = false
    else if (char === '(' && !inClass) {
      if (source[index + 1] !== '?') count += 1
      else if (source[index + 2] === '<' && source[index + 3] !== '=' && source[index + 3] !== '!') {
        count += 1
        named = true
      }
    }
  }
  return { count, named }
}

/**
 * Sets a node's parent.
 *
 * @param parent - The node it sits in
 * @param node - The node placed
 * @returns The node placed
 */
function adopt<T extends RegexNode>(parent: RegexNode, node: T): T {
  node.parent = parent
  return node
}

/**
 * Whether two groups of one name sit in different alternatives of some disjunction, which lets
 * them share the name since only one of them can take part in a match.
 *
 * @param existing - A group parsed earlier
 * @param group - The group being opened, placed under its alternative
 * @returns True when no alternative holds both
 */
function inDifferentAlternatives(existing: RegexNode, group: RegexNode): boolean {
  const ancestors = createSet<RegexNode>()
  for (let node = existing.parent; node !== null; node = node.parent) ancestors.add(node)
  let common = group.parent as RegexNode
  while (!ancestors.has(common)) common = common.parent as RegexNode
  return common.kind !== 'Alternative'
}

/** Reads a pattern from its start to its end. */
class PatternParser {
  /** The pattern being read. */
  private readonly reader: PatternReader
  /** The capturing groups opened so far, in order of their opening parenthesis. */
  private readonly groups: CapturingGroupNode[] = []
  /** The backreferences read so far, resolved once every group is known. */
  private readonly backreferences: BackreferenceNode[] = []
  /** How many capturing groups the whole pattern opens. */
  private groupCount = 0

  /**
   * Prepares to read a pattern.
   *
   * @param reader - The pattern being read
   */
  constructor(reader: PatternReader) {
    this.reader = reader
  }

  /**
   * Reads the whole pattern.
   *
   * @returns The tree
   */
  parsePattern(): PatternNode {
    const scan = scanGroups(this.reader.source)
    this.groupCount = scan.count
    this.reader.namedGroups = scan.named
    const pattern: PatternNode = { kind: 'Pattern', start: 0, end: 0, parent: null, alternatives: [] }
    this.disjunction(pattern)
    if (this.reader.peek() !== '') this.reader.raise("Unmatched ')'")
    pattern.end = this.reader.index
    this.resolveBackreferences()
    return pattern
  }

  /**
   * Reads alternatives separated by `|` into a node, up to a `)` or the end.
   *
   * @param parent - The node that holds the alternatives
   */
  private disjunction(parent: DisjunctionNode): void {
    const { reader } = this
    do {
      const alternative: AlternativeNode = { kind: 'Alternative', start: reader.index, end: -1, parent, elements: [] }
      parent.alternatives.push(alternative)
      while (!reader.ahead('|') && !reader.ahead(')') && reader.peek() !== '') this.term(alternative)
      alternative.end = reader.index
    } while (reader.eat('|'))
  }

  /**
   * Reads one term of an alternative: an assertion, or an atom with the quantifier that may follow it.
   *
   * @param alternative - The alternative the term joins
   */
  private term(alternative: AlternativeNode): void {
    const assertion = this.assertion(alternative)
    if (assertion !== null) {
      alternative.elements.push(assertion)
      // why: the legacy grammar lets a lookahead take a quantifier; nothing else that asserts a position does.
      if (!this.reader.unicode && assertion.kind === 'Lookaround' && !assertion.behind) this.quantifier(alternative, assertion)
      return
    }
    const atom = this.atom(alternative)
    alternative.elements.push(atom)
    this.quantifier(alternative, atom)
  }

  /**
   * Reads an assertion when one starts here.
   *
   * @param parent - The alternative it joins
   * @returns The assertion, or null with nothing consumed
   */
  private assertion(parent: AlternativeNode): AssertionNode | LookaroundNode | null {
    const { reader } = this
    const start = reader.index
    if (reader.eat('^')) return this.assertionNode(parent, start, 'start')
    if (reader.eat('$')) return this.assertionNode(parent, start, 'end')
    if (reader.eat('\\b')) return this.assertionNode(parent, start, 'word-boundary')
    if (reader.eat('\\B')) return this.assertionNode(parent, start, 'non-word-boundary')
    if (reader.eat('(?=')) return this.lookaround(parent, start, false, false)
    if (reader.eat('(?!')) return this.lookaround(parent, start, false, true)
    if (reader.eat('(?<=')) return this.lookaround(parent, start, true, false)
    if (reader.eat('(?<!')) return this.lookaround(parent, start, true, true)
    return null
  }

  /**
   * Makes an edge or word-boundary assertion ending at the current position.
   *
   * @param parent - The alternative it joins
   * @param start - Where it starts
   * @param assertion - Which position it asserts
   * @returns The node for the assertion, spanning from the start
   */
  private assertionNode(parent: AlternativeNode, start: number, assertion: AssertionKind): AssertionNode {
    return { kind: 'Assertion', start, end: this.reader.index, parent, assertion }
  }

  /**
   * Reads the body of a lookaround whose opening was consumed.
   *
   * @param parent - The alternative it joins
   * @param start - Where it starts
   * @param behind - Whether it looks behind
   * @param negate - Whether it is negative
   * @returns The node
   */
  private lookaround(parent: AlternativeNode, start: number, behind: boolean, negate: boolean): LookaroundNode {
    const node: LookaroundNode = { kind: 'Lookaround', start, end: -1, parent, behind, negate, alternatives: [] }
    this.disjunction(node)
    this.closeGroup(node)
    return node
  }

  /**
   * Consumes the `)` that ends a group.
   *
   * @param node - The group ended
   */
  private closeGroup(node: DisjunctionNode): void {
    if (!this.reader.eat(')')) this.reader.raise('Unterminated group')
    node.end = this.reader.index
  }

  /**
   * Wraps the last term in a quantifier when one follows it.
   *
   * @param alternative - The alternative holding the term
   * @param element - The term, the last of the alternative
   */
  private quantifier(alternative: AlternativeNode, element: ElementNode): void {
    const bounds = this.bounds()
    if (bounds === null) return
    const greedy = !this.reader.eat('?')
    const node: QuantifierNode = {
      kind: 'Quantifier',
      start: element.start,
      end: this.reader.index,
      parent: alternative,
      ...bounds,
      greedy,
      element,
    }
    element.parent = node
    alternative.elements[alternative.elements.length - 1] = node
  }

  /**
   * Reads a quantifier's bounds when one starts here.
   *
   * @returns The bounds, or null with nothing consumed
   */
  private bounds(): Bounds | null {
    const { reader } = this
    if (reader.eat('*')) return { min: 0, max: Infinity }
    if (reader.eat('+')) return { min: 1, max: Infinity }
    if (reader.eat('?')) return { min: 0, max: 1 }
    return this.bracedBounds()
  }

  /**
   * Reads a `{n}`, `{n,}` or `{n,m}` quantifier when one starts here; under a unicode flag a brace
   * that opens no whole quantifier is refused, otherwise it is left to be read as a character.
   *
   * @returns The bounds, or null with nothing consumed
   */
  private bracedBounds(): Bounds | null {
    const { reader } = this
    const start = reader.index
    if (!reader.eat('{')) return null
    const min = this.decimal()
    if (min !== null) {
      const max = reader.eat(',') ? (this.decimal() ?? Infinity) : min
      if (reader.eat('}')) {
        if (max < min) reader.raise('numbers out of order in {} quantifier')
        return { min, max }
      }
    }
    if (reader.unicode) reader.raise('Incomplete quantifier')
    reader.index = start
    return null
  }

  /**
   * Reads a run of decimal digits.
   *
   * @returns Their value, or null with nothing consumed when none follows
   */
  private decimal(): number | null {
    const { reader } = this
    const start = reader.index
    let value = 0
    while (isDigit(reader.peek())) value = value * 10 + codePointOf(reader.advance()) - 48
    return reader.index === start ? null : value
  }

  /**
   * Reads an atom: an escape, a group, a class, `.` or a character.
   *
   * @param parent - The alternative it joins
   * @returns The atom node, or null at the end of the alternative
   */
  private atom(parent: AlternativeNode): ElementNode {
    const { reader } = this
    const start = reader.index
    const char = reader.peek()
    if (char === '\\') return this.atomEscape(parent, start)
    if (char === '(') return this.group(parent, start)
    if (char === '[') {
      reader.advance()
      return adopt(parent, readCharacterClass(reader, start))
    }
    if (char === '*' || char === '+' || char === '?') reader.raise('Nothing to repeat')
    if (char === '{' || char === '}' || char === ']') {
      if (reader.unicode) reader.raise('Lone quantifier brackets')
      // why: the legacy grammar reads a brace as a character unless it opens a whole quantifier, which then repeats nothing.
      if (char === '{' && this.bracedBounds() !== null) reader.raise('Nothing to repeat', start)
    }
    reader.advance()
    if (char === '.') return adopt(parent, characterSetNode(start, reader.index, 'any', false))
    return adopt(parent, reader.character(start, codePointOf(char)))
  }

  /**
   * Reads what a backslash introduces outside a class: a backreference, a set, or a character.
   *
   * @param parent - The alternative it joins
   * @param start - The offset of the backslash
   * @returns The backreference, set or character node
   */
  private atomEscape(parent: AlternativeNode, start: number): ElementNode {
    const { reader } = this
    reader.advance()
    const char = reader.peek()
    if (char === '') reader.raise('\\ at end of pattern')
    if (isDigit(char) && char !== '0') {
      const mark = reader.index
      const number = this.decimal() as number
      if (number <= this.groupCount) return this.backreference(parent, start, number)
      if (reader.unicode) reader.raise('Invalid escape')
      // why: the legacy grammar reads the digits of a reference to no group as an octal escape or as themselves.
      reader.index = mark
    }
    if (char === 'k' && (reader.unicode || reader.namedGroups)) {
      reader.advance()
      if (!reader.eat('<')) reader.raise('Invalid named reference')
      return this.backreference(parent, start, readGroupName(reader))
    }
    const set = readClassEscape(reader, start)
    if (set !== null) return adopt(parent, set)
    const escaped = readCharacterEscape(reader, start, false)
    if (escaped !== null) return adopt(parent, escaped)
    if (reader.unicode) reader.raise('Invalid escape')
    // why: in the legacy grammar a backslash before `c` that opens no control escape stands for itself.
    return adopt(parent, reader.character(start, 0x5c))
  }

  /**
   * Makes a backreference ending at the current position.
   *
   * @param parent - The alternative it joins
   * @param start - The offset of the backslash
   * @param ref - The group number or name
   * @returns The node
   */
  private backreference(parent: AlternativeNode, start: number, ref: number | string): BackreferenceNode {
    const { reader } = this
    const node: BackreferenceNode = {
      kind: 'Backreference',
      start,
      end: reader.index,
      parent,
      ref,
      raw: reader.source.slice(start, reader.index),
      resolved: [],
    }
    this.backreferences.push(node)
    return node
  }

  /**
   * Reads a group of any kind but a lookaround, which the assertion reader took before.
   *
   * @param parent - The alternative it joins
   * @param start - The offset of the `(`
   * @returns The group node, its alternatives read
   */
  private group(parent: AlternativeNode, start: number): GroupNode | CapturingGroupNode {
    const { reader } = this
    reader.advance()
    if (!reader.eat('?')) return this.capturingGroup(parent, start, null)
    if (reader.eat(':')) return this.plainGroup(parent, start, null)
    if (reader.eat('<')) return this.capturingGroup(parent, start, readGroupName(reader))
    return this.plainGroup(parent, start, this.modifiers())
  }

  /**
   * Reads the modifiers between `(?` and `:`.
   *
   * @returns The modifier text
   */
  private modifiers(): string {
    const { reader } = this
    const start = reader.index
    let flags = ''
    const readFlags = (): void => {
      for (let char = reader.peek(); char === 'i' || char === 'm' || char === 's'; char = reader.peek()) {
        if (flags.includes(char)) reader.raise(`Duplicated flag '${char}'`)
        flags += char
        reader.advance()
      }
    }
    readFlags()
    if (reader.eat('-')) {
      readFlags()
      if (!reader.ahead(':')) reader.raise('Invalid group')
      if (flags === '') reader.raise('Invalid empty flags')
    }
    if (!reader.eat(':')) reader.raise('Invalid group')
    return reader.source.slice(start, reader.index - 1)
  }

  /**
   * Reads the body of a non-capturing group.
   *
   * @param parent - The alternative it joins
   * @param start - The offset of the `(`
   * @param modifiers - Its modifier text, or null
   * @returns The modifier group node, its alternatives read
   */
  private plainGroup(parent: AlternativeNode, start: number, modifiers: string | null): GroupNode {
    const node: GroupNode = { kind: 'Group', start, end: -1, parent, alternatives: [], modifiers }
    this.disjunction(node)
    this.closeGroup(node)
    return node
  }

  /**
   * Reads the body of a capturing group.
   *
   * @param parent - The alternative it joins
   * @param start - The offset of the `(`
   * @param name - Its name, or null
   * @returns The capturing group node, its alternatives read
   */
  private capturingGroup(parent: AlternativeNode, start: number, name: string | null): CapturingGroupNode {
    const node: CapturingGroupNode = {
      kind: 'CapturingGroup',
      start,
      end: -1,
      parent,
      name,
      index: this.groups.length + 1,
      alternatives: [],
    }
    if (name !== null && this.groups.some((other) => other.name === name && !inDifferentAlternatives(other, node))) {
      this.reader.raise('Duplicate capture group name')
    }
    this.groups.push(node)
    this.disjunction(node)
    this.closeGroup(node)
    return node
  }

  /** Points every backreference at its groups, refusing a name no group carries. */
  private resolveBackreferences(): void {
    for (const reference of this.backreferences) {
      if (typeof reference.ref === 'number') {
        reference.resolved = [this.groups[reference.ref - 1] as CapturingGroupNode]
        continue
      }
      const named = this.groups.filter((group) => group.name === reference.ref)
      if (named.length === 0) this.reader.raise('Invalid named capture referenced')
      // why: of groups sharing a name, those in a sibling alternative of the reference cannot take part in its match, unless none other can.
      const reachable = named.filter((group) => !inDifferentAlternatives(group, reference))
      reference.resolved = reachable.length === 0 ? named : reachable
    }
  }
}

/**
 * Parses a pattern under its flags.
 *
 * @param pattern - The pattern text, as it stands between the slashes of a literal
 * @param flags - The flags, of which `u` and `v` select the grammar
 * @returns The tree, or the error, with the characters read either way
 *
 * @example Parse a pattern, or read where it was refused
 * ```ts
 * parse('(?<year>\\d{4})', 'u').pattern.kind // => 'Pattern'
 * parse('a{2,1}', '').error
 * // => { message: 'numbers out of order in {} quantifier', index: 6 }
 * parse('[a-z]', 'uv').error
 * // => { message: 'Invalid regular expression flags', index: 0 }
 * ```
 */
export function parse(pattern: string, flags: string): ParseResult {
  const unicodeSets = flags.includes('v')
  const reader = new PatternReader(pattern, unicodeSets || flags.includes('u'), unicodeSets)
  try {
    if (unicodeSets && flags.includes('u')) reader.raise('Invalid regular expression flags')
    return { pattern: new PatternParser(reader).parsePattern(), error: null, characters: reader.characters }
  } catch (error) {
    // why: the parser throws nothing but pattern failures; anything else is a defect to surface, not an invalid pattern.
    /* node:coverage ignore next 1 */
    if (!(error instanceof PatternFailure)) throw error
    return { pattern: null, error: { message: error.message, index: error.index }, characters: reader.characters }
  }
}
