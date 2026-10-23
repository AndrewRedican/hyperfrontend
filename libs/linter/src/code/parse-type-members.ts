/**
 * The object-shaped types: tuples, type literals and interface bodies with their property, method,
 * call, construct and index signatures, and mapped types.
 *
 * @module code/parse-type-members
 */

import type { Node } from './model'
import type { Parser } from './parser'
import { isIndexSignature, parseIndexSignature } from './parse-classes'
import { parseParameters, parsePropertyKey, startsPropertyKey } from './parse-functions'
import { parseType, parseTypeAnnotation, parseTypeParameters } from './parse-types'

/**
 * Parses a tuple type.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse named, optional and rest elements
 * ```ts
 * const p = new Parser('[id: string, count?: number, ...rest: boolean[]]', '.ts')
 * parseTupleType(p).elementTypes.map((element) => element.kind)
 * // => ['TSNamedTupleMember', 'TSNamedTupleMember', 'TSRestType']
 * ```
 */
export function parseTupleType(p: Parser): Node {
  const start = p.next().start
  const elementTypes: Node[] = []
  while (!p.is(']')) {
    elementTypes.push(parseTupleElement(p))
    if (!p.is(']')) p.expect(',')
  }
  p.expect(']')
  return p.node('TSTupleType', start, { elementTypes })
}

/**
 * Parses one tuple element: rest, named, optional or plain.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseTupleElement(p: Parser): Node {
  const start = p.token.start
  if (p.eat('...')) {
    const typeAnnotation = parseTupleElement(p)
    return p.node('TSRestType', start, { typeAnnotation })
  }
  const named = p.lookahead(() => {
    if (p.token.kind !== 'name') return false
    p.next()
    if (p.eat('?')) return p.is(':')
    return p.is(':')
  })
  if (named === true) {
    const label = p.identifier()
    const optional = p.eat('?')
    p.expect(':')
    const elementType = parseType(p)
    return p.node('TSNamedTupleMember', start, { label, elementType, optional })
  }
  const type = parseType(p)
  if (p.eat('?')) return p.node('TSOptionalType', start, { typeAnnotation: type })
  return type
}

/**
 * Whether a `{` opens a mapped type: `{ [K in`, with optional readonly modifiers.
 *
 * @param p - The parser
 * @returns True for a mapped type
 *
 * @example Tell a mapped type from an index signature
 * ```ts
 * isMappedType(new Parser('{ readonly [K in Keys]: V }', '.ts')) // => true
 * isMappedType(new Parser('{ [key: string]: V }', '.ts')) // => false
 * ```
 */
export function isMappedType(p: Parser): boolean {
  return (
    p.lookahead(() => {
      p.next()
      if (p.is('+') || p.is('-')) p.next()
      p.eatWord('readonly')
      if (!p.eat('[')) return false
      if (p.token.kind !== 'name') return false
      p.next()
      return p.isWord('in')
    }) === true
  )
}

/**
 * Parses a mapped type.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a mapped type with modifier signs
 * ```ts
 * const p = new Parser('{ -readonly [K in keyof T]?: T[K] }', '.ts')
 * const node = parseMappedType(p)
 * node.readonly // => '-'
 * node.optional // => true
 * ```
 */
export function parseMappedType(p: Parser): Node {
  const start = p.next().start
  let readonly: boolean | string = false
  if (p.is('+') || p.is('-')) {
    readonly = p.next().value
    p.expectWord('readonly')
  } else if (p.eatWord('readonly')) readonly = true
  p.expect('[')
  const key = p.identifier()
  p.expectWord('in')
  const constraint = parseType(p)
  const nameType = p.eatWord('as') ? parseType(p) : null
  p.expect(']')
  let optional: boolean | string = false
  if (p.is('+') || p.is('-')) {
    optional = p.next().value
    p.expect('?')
  } else if (p.eat('?')) optional = true
  const typeAnnotation = p.eat(':') ? parseType(p) : undefined
  p.eat(';')
  p.expect('}')
  return p.node('TSMappedType', start, { key, constraint, nameType, typeAnnotation, optional, readonly })
}

/**
 * Parses an object type literal.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse an object type with a method
 * ```ts
 * const p = new Parser('{ id: string; load(): void }', '.ts')
 * parseTypeLiteral(p).members.map((member) => member.kind)
 * // => ['TSPropertySignature', 'TSMethodSignature']
 * ```
 */
export function parseTypeLiteral(p: Parser): Node {
  const start = p.token.start
  const members = parseTypeMembers(p)
  return p.node('TSTypeLiteral', start, { members })
}

/**
 * Parses the members of an object type or interface body, braces included.
 *
 * @param p - The parser
 * @returns The nodes built, in source order
 *
 * @example Parse call, construct and index signatures
 * ```ts
 * const text = '{ (input: string): number; new (): Parser; [key: string]: T }'
 * const p = new Parser(text, '.ts')
 * parseTypeMembers(p).map((member) => member.kind)
 * // => ['TSCallSignatureDeclaration', 'TSConstructSignatureDeclaration',
 * //     'TSIndexSignature']
 * ```
 */
export function parseTypeMembers(p: Parser): Node[] {
  p.expect('{')
  const members: Node[] = []
  while (!p.is('}')) {
    const member = parseTypeMember(p)
    members.push(member)
    if (p.eat(';') || p.eat(',')) {
      member.end = p.lastEnd
      continue
    }
    // why: an index signature reads its own separator, as a class member does.
    const separated = member.kind === 'TSIndexSignature' && (p.text[member.end - 1] === ';' || p.text[member.end - 1] === ',')
    if (!separated && !p.is('}') && !p.token.newlineBefore) p.fail("';' expected.")
  }
  p.expect('}')
  return members
}

/**
 * Parses one member of an object type.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseTypeMember(p: Parser): Node {
  const start = p.token.start
  if (p.is('(') || p.is('<')) return parseSignature(p, start, 'TSCallSignatureDeclaration')
  if (p.isWord('new') && p.peek().kind === 'punct' && (p.peek().value === '(' || p.peek().value === '<')) {
    p.next()
    return parseSignature(p, start, 'TSConstructSignatureDeclaration')
  }
  const readonly =
    p.isWordFollowedBy('readonly', (after) => startsPropertyKey(after) || (after.kind === 'punct' && after.value === '[')) &&
    p.eatWord('readonly')
  if (p.is('[') && isIndexSignature(p)) {
    return parseIndexSignature(p, start, { readonly, static: false, accessibility: undefined })
  }
  const accessorKind =
    (p.isWord('get') || p.isWord('set')) && startsPropertyKey(p.peek()) && !p.peek().newlineBefore ? p.next().value : null
  const { key, computed } = parsePropertyKey(p)
  const optional = p.eat('?')
  if (p.is('(') || p.is('<')) {
    const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
    const params = parseParameters(p)
    const returnType = p.is(':') ? parseTypeAnnotation(p) : undefined
    return p.node('TSMethodSignature', start, {
      key,
      computed,
      optional,
      typeParameters,
      params,
      returnType,
      methodKind: accessorKind ?? 'method',
      readonly,
    })
  }
  if (accessorKind !== null) p.fail("'(' expected.")
  const typeAnnotation = p.is(':') ? parseTypeAnnotation(p) : undefined
  return p.node('TSPropertySignature', start, { key, computed, optional, readonly, typeAnnotation })
}

/**
 * Parses a call or construct signature.
 *
 * @param p - The parser
 * @param start - The offset the signature starts at
 * @param kind - Which signature
 * @returns The node built
 */
function parseSignature(p: Parser, start: number, kind: 'TSCallSignatureDeclaration' | 'TSConstructSignatureDeclaration'): Node {
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  const params = parseParameters(p)
  const returnType = p.is(':') ? parseTypeAnnotation(p) : undefined
  return p.node(kind, start, { typeParameters, params, returnType })
}
