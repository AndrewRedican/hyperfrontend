/**
 * The JSDoc type expression parser: the TypeScript-flavoured grammar the previous linter read
 * inside braces, names, unions, generics, arrays, records, tuples, functions, literals and the
 * name paths of JSDoc, each node with its offsets in the expression.
 *
 * @module jsdoc/types
 */

import { constructorType, functionType, importType, modulePath, object, parenthesised, signature, tuple } from './type-compound'

/** What a type expression is made of. */
export type TypeKind =
  | 'name'
  | 'namePath'
  | 'any'
  | 'unknown'
  | 'string'
  | 'number'
  | 'union'
  | 'intersection'
  | 'generic'
  | 'array'
  | 'optional'
  | 'nullable'
  | 'notNullable'
  | 'variadic'
  | 'object'
  | 'field'
  | 'index'
  | 'tuple'
  | 'member'
  | 'function'
  | 'parameter'
  | 'typeof'
  | 'keyof'
  | 'readonly'
  | 'import'
  | 'indexed'
  | 'parens'
  | 'conditional'
  | 'predicate'
  | 'template'

/** One node of a type expression. */
export interface TypeNode {
  /** What the node is. */
  readonly kind: TypeKind
  /** The offset in the expression where it starts. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
  /** A name, a literal's text, a field's key, a parameter's name, a member's label, a path's separator, an operator. */
  readonly value?: string
  /** The nodes it holds: a union's members, a generic's arguments, a record's fields, a function's parameters. */
  readonly elements?: readonly TypeNode[]
  /** The node it wraps or qualifies: an array's element, a generic's name, a function's return, a field's type, a path's left. */
  readonly left?: TypeNode
  /** A second node: an indexed access's index, a conditional's extends, a path's right. */
  readonly right?: TypeNode
  /** A third node: a conditional's true branch. */
  readonly third?: TypeNode
  /** A fourth node: a conditional's false branch. */
  readonly fourth?: TypeNode
  /** Whether a generic used the dotted form, a field or member is optional, a function is an arrow or a constructor. */
  readonly flag?: string
}

/** What parsing a type expression produced. */
export interface TypeParse {
  /** The root node, or null when the expression is invalid. */
  readonly node: TypeNode | null
  /** Why the expression is invalid, or null. */
  readonly error: string | null
}

/** The characters that may start a name. */
const NAME_START = /[A-Za-z_$À-￿]/

/** The characters that may continue a name. */
const NAME_PART = /[A-Za-z0-9_$À-￿]/

/** A failure to parse. */
class TypeSyntaxError extends Error {}

/**
 * The parser over one expression; the compound forms live beside it.
 *
 * @example Step over whitespace and consume a word
 * ```ts
 * const p = new TypeParser('  string')
 * p.is('string') // => true, after skipping to offset 2
 * p.eat('string') // => true
 * p.pos // => 8
 * ```
 */
export class TypeParser {
  /** The expression. */
  readonly text: string
  /** The offset being read. */
  pos = 0

  /**
   * Starts at the beginning of an expression.
   *
   * @param text - The expression
   */
  constructor(text: string) {
    this.text = text
  }

  /**
   * Skips whitespace.
   */
  skip(): void {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos] as string)) this.pos += 1
  }

  /**
   * Whether the text continues with a string, whitespace skipped.
   *
   * @param expected - The string looked for
   * @returns Whether it is next
   */
  is(expected: string): boolean {
    this.skip()
    return this.text.startsWith(expected, this.pos)
  }

  /**
   * Consumes a string when it is next.
   *
   * @param expected - The string looked for
   * @returns Whether it was consumed
   */
  eat(expected: string): boolean {
    if (!this.is(expected)) return false
    this.pos += expected.length
    return true
  }

  /**
   * Consumes a string or fails.
   *
   * @param expected - The string required
   */
  expect(expected: string): void {
    if (!this.eat(expected)) this.fail()
  }

  /**
   * Fails the parse.
   */
  fail(): never {
    throw new TypeSyntaxError(`Syntax error in type: ${this.text}`)
  }

  /**
   * Whether a word is next, whole.
   *
   * @param word - The word looked for
   * @returns Whether it is next and not part of a longer name
   */
  isWord(word: string): boolean {
    return this.is(word) && !NAME_PART.test(this.text[this.pos + word.length] ?? '')
  }

  /**
   * Reads a name.
   *
   * @returns The name read
   */
  name(): string {
    this.skip()
    const start = this.pos
    if (!NAME_START.test(this.text[this.pos] ?? '')) this.fail()
    while (NAME_PART.test(this.text[this.pos] ?? '')) this.pos += 1
    return this.text.slice(start, this.pos)
  }

  /**
   * Parses a whole type: a union of intersections, or a conditional.
   *
   * @returns The node
   */
  type(): TypeNode {
    const start = this.posAfterSkip()
    const left = this.union()
    if (this.isWord('extends')) {
      this.pos += 7
      const right = this.union()
      this.expect('?')
      const third = this.type()
      this.expect(':')
      const fourth = this.type()
      return { kind: 'conditional', start, end: fourth.end, left, right, third, fourth }
    }
    if (this.isWord('is')) {
      this.pos += 2
      const right = this.type()
      return { kind: 'predicate', start, end: right.end, left, right }
    }
    return left
  }

  /**
   * The offset after the whitespace ahead.
   *
   * @returns The offset
   */
  posAfterSkip(): number {
    this.skip()
    return this.pos
  }

  /**
   * Parses a union: intersections joined by `|`, a leading `|` allowed.
   *
   * @returns The node
   */
  union(): TypeNode {
    const start = this.posAfterSkip()
    this.eat('|')
    const elements = [this.intersection()]
    while (this.eat('|')) elements.push(this.intersection())
    return elements.length === 1 && start === (elements[0] as TypeNode).start
      ? (elements[0] as TypeNode)
      : { kind: 'union', start, end: (elements[elements.length - 1] as TypeNode).end, elements }
  }

  /**
   * Parses an intersection: prefixed types joined by `&`.
   *
   * @returns The node
   */
  intersection(): TypeNode {
    const start = this.posAfterSkip()
    const elements = [this.prefixed()]
    while (this.eat('&')) elements.push(this.prefixed())
    return elements.length === 1
      ? (elements[0] as TypeNode)
      : { kind: 'intersection', start, end: (elements[elements.length - 1] as TypeNode).end, elements }
  }

  /**
   * Parses a type with its prefix operators: `?`, `!`, `...`, `typeof`, `keyof`, `readonly`.
   *
   * @returns The node
   */
  prefixed(): TypeNode {
    const start = this.posAfterSkip()
    const prefixes: readonly [string, TypeKind][] = [
      ['...', 'variadic'],
      ['?', 'nullable'],
      ['!', 'notNullable'],
    ]
    for (const [operator, kind] of prefixes) {
      if (!this.is(operator)) continue
      // why: a `?` alone, before nothing a type could start with, is the unknown type.
      if (operator === '?' && !this.startsType(this.pos + 1)) break
      this.pos += operator.length
      const left = this.prefixed()
      return { kind, start, end: left.end, left }
    }
    for (const word of ['typeof', 'keyof', 'readonly']) {
      if (!this.isWord(word)) continue
      this.pos += word.length
      const left = this.prefixed()
      return { kind: word as TypeKind, start, end: left.end, left }
    }
    return this.postfixed()
  }

  /**
   * Whether a type can start at an offset.
   *
   * @param at - The offset
   * @returns Whether the character there opens a type
   */
  startsType(at: number): boolean {
    let index = at
    while (index < this.text.length && /\s/.test(this.text[index] as string)) index += 1
    const char = this.text[index] ?? ''
    return NAME_START.test(char) || /[({[*?!'"`0-9.-]/.test(char)
  }

  /**
   * Parses a primary type with its suffixes: arrays, generics, optional, nullable, indexed
   * access and name paths.
   *
   * @returns The node
   */
  postfixed(): TypeNode {
    let node = this.primary()
    for (;;) {
      const start = node.start
      if (this.text.startsWith('[]', this.pos)) {
        this.pos += 2
        node = { kind: 'array', start, end: this.pos, left: node }
      } else if (this.text.startsWith('[', this.pos) && node.kind !== 'tuple') {
        this.pos += 1
        const right = this.type()
        this.expect(']')
        node = { kind: 'indexed', start, end: this.pos, left: node, right }
      } else if (this.text.startsWith('.<', this.pos) || this.text.startsWith('<', this.pos)) {
        const dotted = this.text[this.pos] === '.'
        this.pos += dotted ? 2 : 1
        const elements = [this.type()]
        while (this.eat(',')) elements.push(this.type())
        this.expect('>')
        node = { kind: 'generic', start, end: this.pos, left: node, elements, flag: dotted ? 'dot' : 'angle' }
      } else if (
        /^[.#~]/.test(this.text.slice(this.pos, this.pos + 1)) &&
        (node.kind === 'name' || node.kind === 'namePath' || node.kind === 'generic' || node.kind === 'import')
      ) {
        const separator = this.text[this.pos] as string
        this.pos += 1
        const right = this.pathPart()
        node = { kind: 'namePath', start, end: right.end, left: node, right, value: separator }
      } else if (this.text.startsWith('=', this.pos) && !this.text.startsWith('=>', this.pos)) {
        this.pos += 1
        node = { kind: 'optional', start, end: this.pos, left: node }
      } else if (this.text.startsWith('?', this.pos) && !this.startsType(this.pos + 1)) {
        this.pos += 1
        node = { kind: 'nullable', start, end: this.pos, left: node }
      } else if (this.text.startsWith('!', this.pos)) {
        this.pos += 1
        node = { kind: 'notNullable', start, end: this.pos, left: node }
      } else return node
    }
  }

  /**
   * Parses the part of a name path after its separator: a name, a quoted name, or an event or
   * external reference.
   *
   * @returns The node
   */
  pathPart(): TypeNode {
    const start = this.pos
    const char = this.text[this.pos] ?? ''
    if (char === '"' || char === "'") return this.stringLiteral()
    if (this.text.startsWith('event:', this.pos) || this.text.startsWith('external:', this.pos)) {
      const prefix = this.text.startsWith('event:', this.pos) ? 'event:' : 'external:'
      this.pos += prefix.length
      const name = this.name()
      return { kind: 'name', start, end: this.pos, value: `${prefix}${name}` }
    }
    const name = this.name()
    return { kind: 'name', start, end: this.pos, value: name }
  }

  /**
   * Parses a quoted string.
   *
   * @returns The node
   */
  stringLiteral(): TypeNode {
    const start = this.pos
    const quote = this.text[this.pos] as string
    let end = this.pos + 1
    while (end < this.text.length && this.text[end] !== quote) end += this.text[end] === '\\' ? 2 : 1
    if (end >= this.text.length) this.fail()
    this.pos = end + 1
    return { kind: 'string', start, end: this.pos, value: this.text.slice(start + 1, end) }
  }

  /**
   * Parses a primary type.
   *
   * @returns The node
   */
  primary(): TypeNode {
    const start = this.posAfterSkip()
    const char = this.text[this.pos] ?? ''
    if (char === '*') {
      this.pos += 1
      return { kind: 'any', start, end: this.pos }
    }
    if (char === '?') {
      this.pos += 1
      return { kind: 'unknown', start, end: this.pos }
    }
    if (char === '"' || char === "'") return this.stringLiteral()
    if (char === '`') return this.templateLiteral()
    if (/[0-9-]/.test(char)) return this.numberLiteral()
    if (char === '{') return object(this)
    if (char === '[') return tuple(this)
    if (char === '(') return parenthesised(this)
    if (char === '<') return signature(this, start)
    if (this.isWord('function')) return functionType(this)
    if (this.isWord('new')) return constructorType(this)
    if (this.isWord('import')) return importType(this)
    if (this.text.startsWith('module:', this.pos)) return modulePath(this)
    if (this.text.startsWith('event:', this.pos) || this.text.startsWith('external:', this.pos)) return this.pathPart()
    const name = this.name()
    return { kind: 'name', start, end: this.pos, value: name }
  }

  /**
   * Parses a template literal type.
   *
   * @returns The node
   */
  templateLiteral(): TypeNode {
    const start = this.pos
    let end = this.pos + 1
    while (end < this.text.length && this.text[end] !== '`') end += 1
    if (end >= this.text.length) this.fail()
    this.pos = end + 1
    return { kind: 'template', start, end: this.pos, value: this.text.slice(start + 1, end) }
  }

  /**
   * Parses a number literal.
   *
   * @returns The node
   */
  numberLiteral(): TypeNode {
    const start = this.pos
    let end = this.pos + (this.text[this.pos] === '-' ? 1 : 0)
    const digits = end
    while (/[0-9]/.test(this.text[end] ?? '')) end += 1
    if (end === digits) this.fail()
    if (this.text[end] === '.' && /[0-9]/.test(this.text[end + 1] ?? '')) {
      end += 1
      while (/[0-9]/.test(this.text[end] ?? '')) end += 1
    }
    this.pos = end
    return { kind: 'number', start, end, value: this.text.slice(start, end) }
  }
}

/**
 * Parses a type expression.
 *
 * @param text - The expression, without braces
 * @returns The root node, or the error
 *
 * @example Parse a type expression, or report why it fails
 * ```ts
 * parseType('Array<string> | null').node.kind // => 'union'
 * parseType('Array<') // => { node: null, error: 'Syntax error in type: Array<' }
 * ```
 */
export function parseType(text: string): TypeParse {
  const parser = new TypeParser(text)
  try {
    const node = parser.type()
    parser.skip()
    if (parser.pos !== text.length) parser.fail()
    return { node, error: null }
  } catch (error) {
    // why: the parser throws nothing but its own failures.
    /* node:coverage ignore next 1 */
    if (!(error instanceof TypeSyntaxError)) throw error
    return { node: null, error: error.message }
  }
}

/**
 * Every node of a type expression, the root first, in document order.
 *
 * @param node - The root
 * @param found - The nodes found so far
 * @returns The nodes, the root first
 *
 * @example Walk every node of a generic type
 * ```ts
 * const { node } = parseType('Map<string, User[]>')
 * typeNodes(node).map((type) => type.kind)
 * // => ['generic', 'name', 'name', 'array', 'name']
 * ```
 */
export function typeNodes(node: TypeNode, found: TypeNode[] = []): TypeNode[] {
  found.push(node)
  for (const child of [node.left, node.right, node.third, node.fourth, ...(node.elements ?? [])])
    if (child !== undefined) typeNodes(child, found)
  return found
}
