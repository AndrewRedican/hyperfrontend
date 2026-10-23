/**
 * Functions and the shapes shared with them: parameters, binding patterns, the conversion of an
 * expression into an assignment target, object literals, arrows from a parenthesis, and
 * function expressions.
 *
 * @module code/parse-functions
 */

import type { Node } from './model'
import type { Parser } from './parser'
import type { Token } from './scanner'
import { parseNumberLiteral, parseStringLiteral } from './literals'
import { draft, finishArrow, parseAssignment, parseExpression, parseFunctionBody } from './parse-expressions'
import { parsePrivateName, parseSpread, parseTypeArgumentsInExpression } from './parse-members'
import { parseTypeAnnotation, parseTypeParameters } from './parse-types'

/** A property key with whether it is computed. */
export interface PropertyKey {
  /** The key node. */
  readonly key: Node
  /** Whether the key was written in brackets. */
  readonly computed: boolean
}

/** The modifiers a constructor parameter may carry. */
const PARAMETER_MODIFIERS = ['public', 'protected', 'private', 'readonly', 'override']

/**
 * Parses a property key: a name, a string, a number, a private name or a computed expression.
 *
 * @param p - The parser
 * @returns The key and whether it is computed
 *
 * @example Parse a computed key and a private name
 * ```ts
 * parsePropertyKey(new Parser('[Symbol.iterator]', '.ts')).computed // => true
 * const { key } = parsePropertyKey(new Parser('#secret', '.ts'))
 * key.kind // => 'PrivateIdentifier'
 * ```
 */
export function parsePropertyKey(p: Parser): PropertyKey {
  const token = p.token
  if (token.kind === 'punct' && token.value === '[') {
    p.next()
    const key = parseAssignment(p)
    p.expect(']')
    return { key, computed: true }
  }
  if (token.kind === 'string') return { key: parseStringLiteral(p), computed: false }
  if (token.kind === 'number') return { key: parseNumberLiteral(p), computed: false }
  if (token.kind === 'private') return { key: parsePrivateName(p), computed: false }
  return { key: p.propertyName(), computed: false }
}

/**
 * Parses a binding pattern or identifier, with its type annotation and default.
 *
 * @param p - The parser
 * @param allowDefault - Whether `= value` may follow
 * @returns The node built
 *
 * @example Parse a typed pattern with a default
 * ```ts
 * const p = new Parser('{ id, name = "guest" }: User = {}', '.ts')
 * const node = parseBindingElement(p)
 * node.kind // => 'AssignmentPattern'
 * node.left.typeAnnotation.kind // => 'TSTypeAnnotation'
 * ```
 */
export function parseBindingElement(p: Parser, allowDefault = true): Node {
  const start = p.token.start
  let target = parseBindingTarget(p)
  if (p.is('?')) {
    p.next()
    draft(target).optional = true
    target.end = p.lastEnd
  }
  if (p.is(':')) {
    draft(target).typeAnnotation = parseTypeAnnotation(p)
    target.end = p.lastEnd
  }
  if (allowDefault && p.eat('=')) {
    const right = parseAssignment(p)
    target = p.node('AssignmentPattern', start, { left: target, right })
  }
  return target
}

/**
 * Parses an identifier, an array pattern or an object pattern.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse an array pattern with a hole and a rest
 * ```ts
 * const node = parseBindingTarget(new Parser('[first, , ...rest]', '.ts'))
 * node.elements.map((element) => element?.kind ?? null)
 * // => ['Identifier', null, 'RestElement']
 * ```
 */
export function parseBindingTarget(p: Parser): Node {
  const start = p.token.start
  if (p.is('[')) {
    p.next()
    const elements: (Node | null)[] = []
    while (!p.is(']')) {
      if (p.is(',')) {
        p.next()
        elements.push(null)
        continue
      }
      elements.push(p.is('...') ? parseRest(p) : parseBindingElement(p))
      if (!p.is(']')) p.expect(',')
    }
    p.expect(']')
    return p.node('ArrayPattern', start, { elements })
  }
  if (p.is('{')) {
    p.next()
    const properties: Node[] = []
    while (!p.is('}')) {
      if (p.is('...')) properties.push(parseRest(p))
      else {
        const propertyStart = p.token.start
        const shorthandToken = p.token
        const { key, computed } = parsePropertyKey(p)
        if (p.eat(':')) {
          const value = parseBindingElement(p)
          properties.push(
            p.node('Property', propertyStart, { key, value, computed, shorthand: false, method: false, propertyKind: 'init' })
          )
        } else {
          if (computed || key.kind !== 'Identifier' || !p.isIdentifier(shorthandToken)) p.fail("':' expected.")
          let value: Node = p.node('Identifier', key.start, { name: key.name })
          if (p.eat('=')) {
            const right = parseAssignment(p)
            value = p.node('AssignmentPattern', propertyStart, { left: value, right })
          }
          properties.push(
            p.node('Property', propertyStart, { key, value, computed: false, shorthand: true, method: false, propertyKind: 'init' })
          )
        }
      }
      if (!p.is('}')) p.expect(',')
    }
    p.expect('}')
    return p.node('ObjectPattern', start, { properties })
  }
  return p.identifier()
}

/**
 * Parses a rest element.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseRest(p: Parser): Node {
  const start = p.next().start
  const argument = parseBindingTarget(p)
  const typeAnnotation = p.is(':') ? parseTypeAnnotation(p) : undefined
  return p.node('RestElement', start, { argument, typeAnnotation })
}

/**
 * Parses a parameter list, the parentheses included.
 *
 * @param p - The parser
 * @param inClass - Whether constructor parameter properties and decorators are allowed
 * @returns The nodes built, in source order
 *
 * @example Parse a constructor's parameter property
 * ```ts
 * const p = new Parser('(private readonly store: Store, id?: string)', '.ts')
 * parseParameters(p, true).map((param) => param.kind)
 * // => ['TSParameterProperty', 'Identifier']
 * // Without inClass, the same text fails: "A parameter property is only
 * // allowed in a constructor implementation."
 * ```
 */
export function parseParameters(p: Parser, inClass = false): Node[] {
  p.expect('(')
  const params: Node[] = []
  while (!p.is(')')) {
    params.push(parseParameter(p, inClass))
    if (!p.is(')')) p.expect(',')
  }
  p.expect(')')
  return params
}

/**
 * Parses one parameter.
 *
 * @param p - The parser
 * @param inClass - Whether constructor parameter properties and decorators are allowed
 * @returns The node built
 */
function parseParameter(p: Parser, inClass: boolean): Node {
  const start = p.token.start
  const decorators: Node[] = []
  while (p.is('@')) {
    const at = p.next().start
    const expression = parseLeftHandSideForDecorator(p)
    decorators.push(p.node('Decorator', at, { expression }))
  }
  let accessibility: string | undefined
  let readonly = false
  let override = false
  while (p.token.kind === 'name' && PARAMETER_MODIFIERS.includes(p.token.value) && startsParameterAfter(p.peek())) {
    const word = p.next().value
    if (word === 'readonly') readonly = true
    else if (word === 'override') override = true
    else accessibility = word
  }
  if (p.is('...')) {
    const rest = parseRest(p)
    if (decorators.length > 0) draft(rest).decorators = decorators
    return rest
  }
  const parameter = p.isWord('this') ? parseThisParameter(p) : parseBindingElement(p)
  if (decorators.length > 0) draft(parameter).decorators = decorators
  if (accessibility !== undefined || readonly || override) {
    if (!inClass) p.fail('A parameter property is only allowed in a constructor implementation.', start)
    return p.node('TSParameterProperty', start, {
      accessibility,
      readonly,
      override,
      parameter,
      decorators: decorators.length > 0 ? decorators : undefined,
    })
  }
  return parameter
}

/**
 * Parses the `this` parameter of a function.
 *
 * @param p - The parser
 * @returns An identifier named `this` with its type
 */
function parseThisParameter(p: Parser): Node {
  const token = p.next()
  const typeAnnotation = p.is(':') ? parseTypeAnnotation(p) : undefined
  return p.node('Identifier', token.start, { name: 'this', typeAnnotation })
}

/**
 * Whether the token after a would-be modifier begins a parameter.
 *
 * @param token - The token to inspect
 * @returns True for a name, a pattern opener or a rest
 */
function startsParameterAfter(token: Token): boolean {
  return token.kind === 'name' || token.kind === 'private' || (token.kind === 'punct' && ['[', '{', '...', '@'].includes(token.value))
}

/**
 * Parses the expression of a decorator: a name with member accesses and one optional call.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a decorator's call expression
 * ```ts
 * const p = new Parser('Component.define({ tag: "app-root" })', '.ts')
 * const node = parseLeftHandSideForDecorator(p)
 * node.kind // => 'CallExpression'
 * node.callee.kind // => 'MemberExpression'
 * ```
 */
export function parseLeftHandSideForDecorator(p: Parser): Node {
  const start = p.token.start
  let expression: Node
  if (p.is('(')) {
    p.next()
    expression = parseExpression(p)
    p.expect(')')
  } else expression = p.identifier()
  while (p.is('.')) {
    p.next()
    const property = p.propertyName()
    expression = p.node('MemberExpression', start, { object: expression, property, computed: false, optional: false })
  }
  const typeArguments = p.is('<') ? p.tryParse(() => parseTypeArgumentsInExpression(p)) : null
  if (p.is('(')) {
    const args = parseArgumentsForDecorator(p)
    expression = p.node('CallExpression', start, {
      callee: expression,
      arguments: args,
      optional: false,
      typeArguments: typeArguments ?? undefined,
    })
  } else if (typeArguments !== null) expression = p.node('TSInstantiationExpression', start, { expression, typeArguments })
  return expression
}

/**
 * Parses a decorator call's arguments.
 *
 * @param p - The parser
 * @returns The nodes built, in source order
 */
function parseArgumentsForDecorator(p: Parser): Node[] {
  p.expect('(')
  const args: Node[] = []
  while (!p.is(')')) {
    args.push(p.is('...') ? parseSpread(p) : parseAssignment(p))
    if (!p.is(')')) p.expect(',')
  }
  p.expect(')')
  return args
}

/**
 * Reinterprets an expression as an assignment target.
 *
 * @param p - The parser
 * @param node - The expression
 * @returns The same node, reinterpreted
 *
 * @example Turn an array literal into a destructuring target
 * ```ts
 * const p = new Parser('[first, second]', '.ts')
 * const target = toPattern(p, parseAssignment(p))
 * target.kind // => 'ArrayPattern' (the same node, rewritten in place)
 * // An expression such as `a + b` fails: "Invalid left-hand side in assignment."
 * ```
 */
export function toPattern(p: Parser, node: Node): Node {
  const target = draft(node)
  switch (node.kind) {
    case 'ArrayExpression':
      target.kind = 'ArrayPattern'
      target.elements = (node.elements ?? []).map((element) => (element === null ? null : toPattern(p, element)))
      return node
    case 'ObjectExpression':
      target.kind = 'ObjectPattern'
      target.properties = (node.properties ?? []).map((property) => {
        if (property.kind === 'SpreadElement') return toPattern(p, property)
        draft(property).value = toPattern(p, property.value as Node)
        return property
      })
      return node
    case 'SpreadElement':
      target.kind = 'RestElement'
      target.argument = toPattern(p, node.argument as Node)
      return node
    case 'AssignmentExpression':
      if (node.operator !== '=') p.fail('Invalid left-hand side in assignment.', node.start)
      target.kind = 'AssignmentPattern'
      target.operator = undefined
      return node
    case 'Identifier':
    case 'MemberExpression':
    case 'ArrayPattern':
    case 'ObjectPattern':
    case 'AssignmentPattern':
    case 'RestElement':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
      return node
    default:
      return p.fail('Invalid left-hand side in assignment.', node.start)
  }
}

/**
 * Parses an object literal.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse shorthand, spread and accessor properties
 * ```ts
 * const p = new Parser('{ id, ...rest, get label() { return id } }', '.ts')
 * const { properties } = parseObjectLiteral(p)
 * properties[0].shorthand // => true
 * properties[1].kind // => 'SpreadElement'
 * properties[2].propertyKind // => 'get'
 * ```
 */
export function parseObjectLiteral(p: Parser): Node {
  const start = p.next().start
  const properties: Node[] = []
  while (!p.is('}')) {
    properties.push(p.is('...') ? parseSpread(p) : parseObjectProperty(p))
    if (!p.is('}')) p.expect(',')
  }
  p.expect('}')
  return p.node('ObjectExpression', start, { properties })
}

/**
 * Parses one property of an object literal: a method, an accessor, a key with a value, or a
 * shorthand.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseObjectProperty(p: Parser): Node {
  const start = p.token.start
  const first = p.token
  const async = p.isWordFollowedBy('async', (after) => startsPropertyKey(after) || (after.kind === 'punct' && after.value === '*'))
  if (async) p.next()
  const generator = p.eat('*')
  const accessor =
    !async && !generator && (first.value === 'get' || first.value === 'set') && first.kind === 'name' && startsPropertyKey(p.peek())
      ? first.value
      : null
  if (accessor !== null) p.next()
  const { key, computed } = parsePropertyKey(p)
  if (p.is('(') || p.is('<')) {
    const value = parseFunctionTail(p, p.token.start, async, generator, false, false)
    const method = accessor === null
    return p.node('Property', start, { key, value, computed, shorthand: false, method, propertyKind: accessor ?? 'init' })
  }
  if (accessor !== null || async || generator) p.fail("'(' expected.")
  if (p.eat(':')) {
    const value = parseAssignment(p)
    return p.node('Property', start, { key, value, computed, shorthand: false, method: false, propertyKind: 'init' })
  }
  if (computed || key.kind !== 'Identifier' || !p.isIdentifier(first)) p.fail("':' expected.")
  let value: Node = p.node('Identifier', key.start, { name: key.name })
  if (p.is('=')) {
    p.next()
    const right = parseAssignment(p)
    value = p.node('AssignmentPattern', start, { left: value, right })
  }
  return p.node('Property', start, { key, value, computed: false, shorthand: true, method: false, propertyKind: 'init' })
}

/**
 * Whether a token can begin a property key.
 *
 * @param token - The token to inspect
 * @returns True for a name, string, number, private name or `[`
 *
 * @example Check the token after a modifier
 * ```ts
 * startsPropertyKey(new Parser('[', '.ts').token) // => true
 * startsPropertyKey(new Parser('(', '.ts').token) // => false
 * ```
 */
export function startsPropertyKey(token: Token): boolean {
  return (
    token.kind === 'name' ||
    token.kind === 'string' ||
    token.kind === 'number' ||
    token.kind === 'private' ||
    (token.kind === 'punct' && token.value === '[')
  )
}

/**
 * Parses the type parameters, parameters, return type and body of a function, after its name.
 *
 * @param p - The parser
 * @param start - The offset the function expression starts at
 * @param async - Whether it is async
 * @param generator - Whether it is a generator
 * @param allowSignature - Whether a body may be left out, as an overload signature does
 * @param parameterProperties - Whether parameters may carry accessibility modifiers, as a constructor's do
 * @returns A function expression, or an empty-body function expression for an overload signature
 *
 * @example Parse an overload signature without a body
 * ```ts
 * const p = new Parser('(id: string): User;', '.ts')
 * const node = parseFunctionTail(p, 0, false, false, true, false)
 * node.kind // => 'TSEmptyBodyFunctionExpression'
 * ```
 */
export function parseFunctionTail(
  p: Parser,
  start: number,
  async: boolean,
  generator: boolean,
  allowSignature: boolean,
  parameterProperties: boolean
): Node {
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  const params = parseParameters(p, parameterProperties)
  const returnType = p.is(':') ? parseTypeAnnotation(p) : undefined
  if (!p.is('{')) {
    if (!allowSignature) p.fail("'{' expected.")
    p.semicolon()
    return p.node('TSEmptyBodyFunctionExpression', start, {
      id: null,
      params,
      generator,
      async,
      typeParameters,
      returnType,
      expression: false,
    })
  }
  const outer = { inAsync: p.inAsync, inGenerator: p.inGenerator, noIn: p.noIn }
  p.inAsync = async
  p.inGenerator = generator
  p.noIn = false
  const body = parseFunctionBody(p)
  p.inAsync = outer.inAsync
  p.inGenerator = outer.inGenerator
  p.noIn = outer.noIn
  return p.node('FunctionExpression', start, { id: null, params, body, generator, async, typeParameters, returnType, expression: false })
}

/**
 * Parses a function expression, from its `function` keyword.
 *
 * @param p - The parser
 * @param async - Whether `async` came before
 * @returns The node built
 *
 * @example Parse a named generator expression
 * ```ts
 * const p = new Parser('function* ids() { yield 1 }', '.ts')
 * const node = parseFunctionExpression(p, false)
 * node.id.name // => 'ids'
 * node.generator // => true
 * ```
 */
export function parseFunctionExpression(p: Parser, async: boolean): Node {
  const start = async ? p.lastEnd - 5 : p.token.start
  p.expectWord('function')
  const generator = p.eat('*')
  const outer = { inAsync: p.inAsync, inGenerator: p.inGenerator }
  p.inAsync = async
  p.inGenerator = generator
  const id = p.token.kind === 'name' && !p.is('(') ? p.identifier() : null
  p.inAsync = outer.inAsync
  p.inGenerator = outer.inGenerator
  const node = parseFunctionTail(p, start, async, generator, false, false)
  draft(node).id = id
  return node
}

/**
 * Parses an arrow function from its opening parenthesis or type parameter list, failing where
 * the text turns out to be something else.
 *
 * @param p - The parser
 * @param start - The offset the arrow starts at, before any `async`
 * @param async - Whether `async` came before
 * @returns The node built
 *
 * @example Parse a generic arrow, or fail on a parenthesis
 * ```ts
 * const p = new Parser('<T>(value: T): T => value', '.ts')
 * parseArrowFromParenthesis(p, 0, false).kind // => 'ArrowFunctionExpression'
 * // '(a, b) + c' throws "'=>' expected." at the plus sign
 * ```
 */
export function parseArrowFromParenthesis(p: Parser, start: number, async: boolean): Node {
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  const params = parseParameters(p)
  const returnType = p.is(':') ? parseTypeAnnotation(p) : undefined
  if (!p.is('=>') || p.token.newlineBefore) p.fail("'=>' expected.")
  p.next()
  return finishArrow(p, start, params, async, typeParameters, returnType)
}
