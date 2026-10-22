/**
 * Classes: the heritage clauses and the body, whose members carry decorators, modifiers,
 * accessors, overload signatures, index signatures and static blocks.
 *
 * @module code/parse-classes
 */

import type { Node } from './model.ts'
import type { Parser } from './parser.ts'
import { draft, parseAssignment } from './parse-expressions.ts'
import { parseFunctionTail, parsePropertyKey, startsPropertyKey } from './parse-functions.ts'
import { parseLeftHandSide } from './parse-members.ts'
import { parseDecorators, parseStatement } from './parse-statements.ts'
import { parseTypeAnnotation, parseTypeArguments, parseTypeParameters } from './parse-types.ts'

/** The modifiers a member may carry, in any order. */
const MEMBER_MODIFIERS = ['public', 'protected', 'private', 'static', 'readonly', 'abstract', 'override', 'declare', 'accessor', 'async']

/** The modifiers read before a member's key. */
interface Modifiers {
  /** `public`, `protected` or `private`. */
  accessibility?: string
  /** Whether the member is static. */
  static: boolean
  /** Whether the member is read-only. */
  readonly: boolean
  /** Whether the member is abstract. */
  abstract: boolean
  /** Whether the member overrides. */
  override: boolean
  /** Whether the member is ambient. */
  declare: boolean
  /** Whether the member is an auto-accessor. */
  accessor: boolean
  /** Whether the member is async. */
  async: boolean
}

/**
 * Parses a class, from its decorators or keyword.
 *
 * @param p - The parser
 * @param decorators - The decorators already parsed
 * @param expression - Whether the class is an expression
 * @param declare - Whether the class is ambient
 * @param exported - Whether an export keyword came between the decorators and the class
 * @returns The node built
 */
export function parseClass(p: Parser, decorators: Node[], expression: boolean, declare = false, exported = false): Node {
  // why: decorators written before an export keyword stay outside the class's range, as the old parser placed them.
  const start = exported ? p.token.start : (decorators[0]?.start ?? p.token.start)
  const abstract = p.isWordFollowedBy('abstract', (after) => after.kind === 'name' && after.value === 'class')
  if (abstract) p.next()
  p.expectWord('class')
  const id = p.token.kind === 'name' && !p.isWord('extends') && !p.isWord('implements') ? p.identifier() : null
  if (id === null && !expression) p.fail('Identifier expected.')
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  let superClass: Node | null = null
  let superTypeArguments: Node | undefined
  if (p.eatWord('extends')) {
    superClass = parseLeftHandSide(p)
    if (p.is('<')) superTypeArguments = parseTypeArguments(p)
  }
  const implementsList: Node[] = []
  if (p.eatWord('implements')) {
    do implementsList.push(parseHeritage(p, 'TSClassImplements'))
    while (p.eat(','))
  }
  const body = parseClassBody(p)
  return p.node(expression ? 'ClassExpression' : 'ClassDeclaration', start, {
    decorators,
    id,
    typeParameters,
    superClass,
    superTypeArguments,
    implements: implementsList,
    body,
    abstract,
    declare,
  })
}

/**
 * Parses an entity name with type arguments, as a heritage clause names it.
 *
 * @param p - The parser
 * @param kind - The node kind, an interface heritage or a class implements
 * @returns The node built
 */
export function parseHeritage(p: Parser, kind: 'TSInterfaceHeritage' | 'TSClassImplements'): Node {
  const start = p.token.start
  let expression = p.identifier()
  while (p.is('.')) {
    p.next()
    const property = p.propertyName()
    expression = p.node('MemberExpression', start, { object: expression, property, computed: false, optional: false })
  }
  const typeArguments = p.is('<') ? parseTypeArguments(p) : undefined
  return p.node(kind, start, { expression, typeArguments })
}

/**
 * Parses a class body.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseClassBody(p: Parser): Node {
  const start = p.token.start
  p.expect('{')
  const body: Node[] = []
  while (!p.is('}')) {
    if (p.eat(';')) continue
    body.push(parseMember(p))
  }
  p.expect('}')
  return p.node('ClassBody', start, { body })
}

/**
 * Parses the modifiers before a member's key.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseModifiers(p: Parser): Modifiers {
  const modifiers: Modifiers = {
    static: false,
    readonly: false,
    abstract: false,
    override: false,
    declare: false,
    accessor: false,
    async: false,
  }
  for (;;) {
    const token = p.token
    if (token.kind !== 'name' || !MEMBER_MODIFIERS.includes(token.value)) return modifiers
    if (token.value === 'async') {
      if (!p.isWordFollowedBy('async', (after) => startsPropertyKey(after) || (after.kind === 'punct' && after.value === '*')))
        return modifiers
    } else {
      const after = p.peek()
      if (
        !(startsPropertyKey(after) || (after.kind === 'punct' && (after.value === '*' || after.value === '{' || after.value === '@'))) ||
        (after.newlineBefore && token.value !== 'static')
      )
        return modifiers
    }
    p.next()
    switch (token.value) {
      case 'public':
      case 'protected':
      case 'private':
        modifiers.accessibility = token.value
        break
      default:
        modifiers[token.value as Exclude<keyof Modifiers, 'accessibility'>] = true
    }
  }
}

/**
 * Parses one class member.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseMember(p: Parser): Node {
  const start = p.token.start
  const decorators = parseDecorators(p)
  // why: a static block may open on a later line than its keyword, as the compiler allows.
  if (p.isWord('static') && p.peek().kind === 'punct' && p.peek().value === '{') {
    p.next()
    p.expect('{')
    const body: Node[] = []
    while (!p.is('}')) body.push(parseStatement(p))
    p.expect('}')
    return p.node('StaticBlock', decorators[0]?.start ?? start, { body })
  }
  const modifiers = parseModifiers(p)
  if (p.is('[') && isIndexSignature(p)) return parseIndexSignature(p, decorators[0]?.start ?? start, modifiers)
  const generator = p.eat('*')
  const accessorKind =
    !generator && (p.isWord('get') || p.isWord('set')) && startsPropertyKey(p.peek()) && !p.peek().newlineBefore ? p.next().value : null
  const { key, computed } = parsePropertyKey(p)
  const optional = p.eat('?')
  const definite = !optional && p.eat('!')
  const memberStart = decorators[0]?.start ?? start
  if (p.is('(') || p.is('<')) {
    const isConstructor =
      !computed &&
      !modifiers.static &&
      ((key.kind === 'Identifier' && key.name === 'constructor') || (key.kind === 'Literal' && key.value === 'constructor'))
    const value = parseFunctionTail(p, p.token.start, modifiers.async, generator, true, isConstructor)
    return p.node(modifiers.abstract ? 'TSAbstractMethodDefinition' : 'MethodDefinition', memberStart, {
      key,
      value,
      computed,
      static: modifiers.static,
      methodKind: isConstructor ? 'constructor' : (accessorKind ?? 'method'),
      accessibility: modifiers.accessibility,
      override: modifiers.override,
      optional,
      decorators,
    })
  }
  if (accessorKind !== null || generator || modifiers.async) p.fail("'(' expected.")
  const typeAnnotation = p.is(':') ? parseTypeAnnotation(p) : undefined
  let value: Node | null = null
  if (p.eat('=')) {
    const outer = { inAsync: p.inAsync, inGenerator: p.inGenerator }
    p.inAsync = false
    p.inGenerator = false
    value = parseAssignment(p)
    p.inAsync = outer.inAsync
    p.inGenerator = outer.inGenerator
  }
  p.semicolon()
  if (modifiers.abstract && value !== null) p.fail('Abstract property cannot have an initializer.', value.start)
  const kind = modifiers.accessor ? 'AccessorProperty' : modifiers.abstract ? 'TSAbstractPropertyDefinition' : 'PropertyDefinition'
  return p.node(kind, memberStart, {
    key,
    value,
    computed,
    static: modifiers.static,
    readonly: modifiers.readonly,
    declare: modifiers.declare,
    optional,
    definite,
    accessibility: modifiers.accessibility,
    override: modifiers.override,
    typeAnnotation,
    decorators,
  })
}

/**
 * Whether a `[` opens an index signature rather than a computed key: `[name:`.
 *
 * @param p - The parser
 * @returns True for an index signature
 */
export function isIndexSignature(p: Parser): boolean {
  return (
    p.lookahead(() => {
      p.next()
      if (p.token.kind !== 'name') return false
      p.next()
      return p.is(':')
    }) === true
  )
}

/**
 * Parses an index signature, from its `[`.
 *
 * @param p - The parser
 * @param start - The offset the member starts at
 * @param modifiers - The modifiers read before it
 * @returns The node built
 */
export function parseIndexSignature(p: Parser, start: number, modifiers: Pick<Modifiers, 'readonly' | 'static' | 'accessibility'>): Node {
  p.expect('[')
  const nameToken = p.next()
  const parameter = p.node('Identifier', nameToken.start, { name: nameToken.value })
  draft(parameter).typeAnnotation = parseTypeAnnotation(p)
  parameter.end = p.lastEnd
  p.expect(']')
  const typeAnnotation = p.is(':') ? parseTypeAnnotation(p) : undefined
  if (!p.eat(';')) p.eat(',')
  return p.node('TSIndexSignature', start, {
    parameters: [parameter],
    typeAnnotation,
    readonly: modifiers.readonly,
    static: modifiers.static,
    accessibility: modifiers.accessibility,
  })
}
