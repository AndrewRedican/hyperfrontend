/**
 * The object-shaped types: tuples, type literals and interface bodies with their property, method,
 * call, construct and index signatures, and mapped types.
 *
 * @module code/parse-type-members
 */

import type { Node } from './model.ts'
import type { Parser } from './parser.ts'
import { isIndexSignature, parseIndexSignature } from './parse-classes.ts'
import { parseParameters, parsePropertyKey, startsPropertyKey } from './parse-functions.ts'
import { parseType, parseTypeAnnotation, parseTypeParameters } from './parse-types.ts'

/**
 * Parses a tuple type.
 *
 * @param p - The parser
 * @returns The node built
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
