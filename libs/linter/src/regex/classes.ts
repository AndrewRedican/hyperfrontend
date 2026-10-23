/**
 * Character classes in both grammars: the flat class of characters, ranges and sets that every
 * flag admits, and the `v` class that nests classes, lists strings with `\q{...}` and combines
 * operands with `&&` and `--`.
 *
 * @module regex/classes
 */

import type {
  CharacterClassNode,
  CharacterClassRangeNode,
  CharacterNode,
  CharacterSetNode,
  ClassOperandNode,
  ClassOperationNode,
  ClassOperator,
  ClassStringDisjunctionNode,
  ExpressionCharacterClassNode,
  RegexNode,
  StringAlternativeNode,
} from './model'
import type { PatternReader } from './reader'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readCharacterEscape, readClassEscape } from './escapes'
import { codePointOf } from './reader'

/** A class of either shape. */
export type AnyClassNode = CharacterClassNode | ExpressionCharacterClassNode

/** The characters a `v` class only takes escaped. */
const CLASS_SET_SYNTAX = createSet('()[]{}/-\\|'.split(''))

/** The punctuators a `v` class refuses doubled. */
const RESERVED_DOUBLE_PUNCTUATORS = createSet('&!#$%*+,.:;<=>?@^`~'.split(''))

/** The letters of the class escapes the legacy grammar keeps apart from a range. */
const CLASS_ESCAPE_LETTERS = createSet('dDsSwW'.split(''))

/**
 * Whether a class or an operand can match a string of other than one character, which a negated
 * class may not.
 *
 * @param node - The node asked about
 * @returns True when it may match strings
 *
 * @example A string disjunction with a long alternative may match strings
 * ```ts
 * const { pattern } = parse('[\\q{abc|d}]', 'v')
 * mayContainStrings(pattern.alternatives[0].elements[0]) // => true
 * // so parse('[^\\q{abc}]', 'v') is refused:
 * // 'Negated character class may contain strings'
 * ```
 */
export function mayContainStrings(node: RegexNode): boolean {
  switch (node.kind) {
    case 'ClassStringDisjunction':
      return node.alternatives.some((alternative) => alternative.elements.length !== 1)
    case 'CharacterSet':
      return node.strings
    case 'CharacterClass':
      return !node.negate && node.elements.some(mayContainStrings)
    case 'ExpressionCharacterClass':
      return mayContainStrings(node.expression)
    case 'ClassOperation':
      return node.operator === 'intersection' ? mayContainStrings(node.left) && mayContainStrings(node.right) : mayContainStrings(node.left)
    default:
      return false
  }
}

/**
 * Reads one atom of a flat class: a character, or an escape standing for a character or a set.
 *
 * @param reader - The reader, standing on the atom, which the caller has seen is not the end
 * @returns The character or set read
 */
function readClassAtom(reader: PatternReader): CharacterNode | CharacterSetNode {
  const start = reader.index
  const char = reader.peek()
  if (char !== '\\') {
    reader.advance()
    return reader.character(start, codePointOf(char))
  }
  reader.advance()
  if (reader.peek() === '') reader.raise('\\ at end of pattern')
  if (reader.eat('b')) return reader.character(start, 8)
  const set = readClassEscape(reader, start)
  if (set !== null) return set
  const escaped = readCharacterEscape(reader, start, true)
  if (escaped !== null) return escaped
  if (reader.unicode || reader.peek() !== 'c') reader.raise('Invalid escape')
  // why: in the legacy grammar a backslash before `c` that opens no control escape stands for itself.
  return reader.character(start, 0x5c)
}

/**
 * Whether a class escape such as `\d` follows the `-` the reader stands on, which the legacy
 * grammar reads as three characters rather than a range.
 *
 * @param reader - The reader, standing on a `-`
 * @returns True when a class escape letter follows a backslash after the dash
 */
function aheadClassEscape(reader: PatternReader): boolean {
  return reader.source[reader.index + 1] === '\\' && CLASS_ESCAPE_LETTERS.has(reader.source[reader.index + 2] as string)
}

/**
 * Makes a range between two characters, refusing one out of order.
 *
 * @param reader - The reader, for the position and for refusing
 * @param parent - The class the range sits in
 * @param from - The first character
 * @param to - The last character
 * @returns The range, with both characters under it
 */
function rangeNode(reader: PatternReader, parent: AnyClassNode, from: CharacterNode, to: CharacterNode): CharacterClassRangeNode {
  if (from.value > to.value) reader.raise('Range out of order in character class')
  const range: CharacterClassRangeNode = { kind: 'CharacterClassRange', start: from.start, end: reader.index, parent, from, to }
  from.parent = range
  to.parent = range
  return range
}

/**
 * Reads a flat class, as every flag but `v` has it.
 *
 * @param reader - The reader, standing after the `[` and the `^`
 * @param start - The offset of the `[`
 * @param negate - Whether a `^` followed the `[`
 * @returns The class node, its elements filled
 */
function readFlatClass(reader: PatternReader, start: number, negate: boolean): CharacterClassNode {
  const node: CharacterClassNode = { kind: 'CharacterClass', start, end: -1, parent: null, negate, elements: [] }
  while (!reader.eat(']')) {
    if (reader.peek() === '') reader.raise('Unterminated character class')
    const atom = readClassAtom(reader)
    atom.parent = node
    if (reader.peek() !== '-' || reader.peekSecond() === ']' || reader.peekSecond() === '') {
      node.elements.push(atom)
      continue
    }
    if (atom.kind === 'CharacterSet' || aheadClassEscape(reader)) {
      if (reader.unicode) reader.raise('Invalid character class')
      // why: the legacy grammar reads a set beside a dash as the set, the dash and the next atom.
      node.elements.push(atom)
      continue
    }
    reader.advance()
    const upper = readClassAtom(reader)
    if (upper.kind !== 'Character') reader.raise('Invalid character class')
    node.elements.push(rangeNode(reader, node, atom, upper))
  }
  node.end = reader.index
  return node
}

/**
 * Reads an escaped character of a `v` class or of a string in it.
 *
 * @param reader - The reader, standing after the backslash, on a character that is not the end
 * @param start - The offset of the backslash
 * @returns The character node read
 */
function readClassSetCharacter(reader: PatternReader, start: number): CharacterNode {
  if (reader.eat('b')) return reader.character(start, 8)
  const escaped = readCharacterEscape(reader, start, true)
  if (escaped === null) reader.raise('Invalid escape')
  return escaped
}

/**
 * Opens a string of a `\q{...}` disjunction.
 *
 * @param parent - The disjunction
 * @param start - The offset the string starts at
 * @returns The string, appended to the disjunction
 */
function openStringAlternative(parent: ClassStringDisjunctionNode, start: number): StringAlternativeNode {
  const alternative: StringAlternativeNode = { kind: 'StringAlternative', start, end: -1, parent, elements: [] }
  parent.alternatives.push(alternative)
  return alternative
}

/**
 * Reads a `\q{...}` disjunction of strings.
 *
 * @param reader - The reader, standing after the opening brace
 * @param start - The offset of the backslash
 * @returns The disjunction node with its alternatives
 */
function readStringDisjunction(reader: PatternReader, start: number): ClassStringDisjunctionNode {
  const node: ClassStringDisjunctionNode = { kind: 'ClassStringDisjunction', start, end: -1, parent: null, alternatives: [] }
  let alternative = openStringAlternative(node, reader.index)
  while (!reader.eat('}')) {
    if (reader.eat('|')) {
      alternative.end = reader.index - 1
      alternative = openStringAlternative(node, reader.index)
      continue
    }
    const elementStart = reader.index
    const char = reader.peek()
    if (char === '') reader.raise('Unterminated class string disjunction')
    let element: CharacterNode
    if (char === '\\') {
      reader.advance()
      if (reader.peek() === '') reader.raise('\\ at end of pattern')
      element = readClassSetCharacter(reader, elementStart)
    } else {
      if (CLASS_SET_SYNTAX.has(char) || (RESERVED_DOUBLE_PUNCTUATORS.has(char) && reader.peekSecond() === char)) {
        reader.raise('Invalid character in character class')
      }
      reader.advance()
      element = reader.character(elementStart, codePointOf(char))
    }
    element.parent = alternative
    alternative.elements.push(element)
  }
  alternative.end = reader.index - 1
  node.end = reader.index
  return node
}

/**
 * Reads one operand of a `v` class: a character, an escape, a nested class or a string disjunction.
 *
 * @param reader - The reader, standing on the operand
 * @returns The operand, without a parent
 */
function readClassSetOperand(reader: PatternReader): ClassOperandNode {
  const start = reader.index
  const char = reader.peek()
  if (char === '') reader.raise('Unterminated character class')
  if (char === '[') {
    reader.advance()
    return readCharacterClass(reader, start)
  }
  if (char === '\\') {
    reader.advance()
    if (reader.peek() === '') reader.raise('\\ at end of pattern')
    if (reader.eat('q')) {
      if (!reader.eat('{')) reader.raise('Invalid escape')
      return readStringDisjunction(reader, start)
    }
    const set = readClassEscape(reader, start)
    return set ?? readClassSetCharacter(reader, start)
  }
  if (CLASS_SET_SYNTAX.has(char) || (RESERVED_DOUBLE_PUNCTUATORS.has(char) && reader.peekSecond() === char)) {
    reader.raise('Invalid character in character class')
  }
  reader.advance()
  return reader.character(start, codePointOf(char))
}

/**
 * The operator the reader stands on, when it stands on one.
 *
 * @param reader - The reader, left where it was
 * @returns The operator, or null
 */
function aheadOperator(reader: PatternReader): ClassOperator | null {
  if (reader.ahead('&&')) return 'intersection'
  return reader.ahead('--') ? 'subtraction' : null
}

/**
 * Adds an operand to a union class, as the start of a range when a `-` follows it.
 *
 * @param reader - The reader, standing after the operand
 * @param union - The class
 * @param operand - The operand read
 */
function addUnionElement(reader: PatternReader, union: CharacterClassNode, operand: ClassOperandNode): void {
  if (operand.kind === 'Character' && reader.eat('-')) {
    const upper = readClassSetOperand(reader)
    if (upper.kind !== 'Character') reader.raise('Invalid character class')
    union.elements.push(rangeNode(reader, union, operand, upper))
    return
  }
  operand.parent = union
  union.elements.push(operand)
}

/**
 * Reads the rest of a `v` class whose first operand an operator follows: a chain of one operator.
 *
 * @param reader - The reader, standing on the operator
 * @param start - The offset of the `[`
 * @param negate - Whether a `^` followed the `[`
 * @param first - The first operand
 * @param operator - The operator found
 * @returns The operation node, or the class itself when no operator follows
 */
function readClassOperation(
  reader: PatternReader,
  start: number,
  negate: boolean,
  first: ClassOperandNode,
  operator: ClassOperator
): ExpressionCharacterClassNode {
  const token = operator === 'intersection' ? '&&' : '--'
  let left: ClassOperandNode | ClassOperationNode = first
  do {
    reader.index += 2
    const right = readClassSetOperand(reader)
    const operation: ClassOperationNode = { kind: 'ClassOperation', start, end: reader.index, parent: null, operator, left, right }
    left.parent = operation
    right.parent = operation
    left = operation
  } while (reader.ahead(token))
  if (!reader.eat(']')) reader.raise(reader.peek() === '' ? 'Unterminated character class' : 'Invalid character in character class')
  const node: ExpressionCharacterClassNode = {
    kind: 'ExpressionCharacterClass',
    start,
    end: reader.index,
    parent: null,
    negate,
    expression: left,
  }
  left.parent = node
  if (negate && mayContainStrings(node)) reader.raise('Negated character class may contain strings')
  return node
}

/**
 * Reads a `v` class: empty, a union of operands and ranges, or one operation chained.
 *
 * @param reader - The reader, standing after the `[` and the `^`
 * @param start - The offset of the `[`
 * @param negate - Whether a `^` followed the `[`
 * @returns The class node, its elements or operation filled
 */
function readClassSet(reader: PatternReader, start: number, negate: boolean): AnyClassNode {
  const union: CharacterClassNode = { kind: 'CharacterClass', start, end: -1, parent: null, negate, elements: [] }
  if (!reader.eat(']')) {
    const first = readClassSetOperand(reader)
    const operator = aheadOperator(reader)
    if (operator !== null) return readClassOperation(reader, start, negate, first, operator)
    addUnionElement(reader, union, first)
    while (!reader.eat(']')) {
      if (reader.peek() === '') reader.raise('Unterminated character class')
      if (aheadOperator(reader) !== null) reader.raise('Invalid character in character class')
      addUnionElement(reader, union, readClassSetOperand(reader))
    }
    if (negate && union.elements.some(mayContainStrings)) reader.raise('Negated character class may contain strings')
  }
  union.end = reader.index
  return union
}

/**
 * Reads a character class in the grammar the flags select.
 *
 * @param reader - The reader, standing after the `[`
 * @param start - The offset of the `[`
 * @returns The class, without a parent
 *
 * @example Read a negated legacy class
 * ```ts
 * const reader = new PatternReader('[^a-f]', false, false)
 * reader.index = 1 // after the '['
 * const node = readCharacterClass(reader, 0)
 * node.negate // => true
 * node.elements[0].kind // => 'CharacterClassRange'
 * ```
 */
export function readCharacterClass(reader: PatternReader, start: number): AnyClassNode {
  const negate = reader.eat('^')
  return reader.unicodeSets ? readClassSet(reader, start, negate) : readFlatClass(reader, start, negate)
}
