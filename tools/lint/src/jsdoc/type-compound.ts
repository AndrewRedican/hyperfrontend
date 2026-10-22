/**
 * The compound forms of a JSDoc type expression: records, tuples, functions, imports and module
 * paths, parsed on behalf of the type parser.
 *
 * @module jsdoc/type-compound
 */

import type { TypeNode, TypeParser } from './types.ts'

/**
 * Parses a record type: fields, index signatures and methods between braces.
 *
 * @param p - The parser read from
 * @returns The node
 */
export function object(p: TypeParser): TypeNode {
  const start = p.pos
  p.pos += 1
  const elements: TypeNode[] = []
  while (!p.is('}')) {
    elements.push(field(p))
    if (!p.eat(',') && !p.eat(';')) {
      if (p.is('}')) break
      p.skip()
      if (!fieldStartsAhead(p)) p.fail()
    }
  }
  p.expect('}')
  return { kind: 'object', start, end: p.pos, elements }
}

/**
 * Whether a field could start where the text continues, after a line break stood for a separator.
 *
 * @param p - The parser read from
 * @returns Whether the previous field ended at a line break
 */
function fieldStartsAhead(p: TypeParser): boolean {
  const before = p.text.slice(0, p.pos)
  return /\n\s*$/.test(before)
}

/**
 * Parses one field of a record: a key with an optional type, an index signature, a method,
 * or a spread.
 *
 * @param p - The parser read from
 * @returns The node
 */
function field(p: TypeParser): TypeNode {
  const start = p.posAfterSkip()
  if (p.eat('...')) {
    const left = p.type()
    return { kind: 'variadic', start, end: left.end, left }
  }
  const readonly = p.isWord('readonly') && !/^readonly\s*[?:,;}]/.test(p.text.slice(p.pos))
  if (readonly) p.pos += 8
  if (p.is('[')) {
    p.pos += 1
    const name = p.name()
    p.expect(':')
    const keyType = p.type()
    p.expect(']')
    p.expect(':')
    const left = p.type()
    return { kind: 'index', start, end: left.end, value: name, right: keyType, left }
  }
  p.skip()
  const char = p.text[p.pos] ?? ''
  let key: string
  if (char === '"' || char === "'") key = p.stringLiteral().value as string
  else if (/[0-9]/.test(char)) key = p.numberLiteral().value as string
  else key = p.name()
  const optional = p.eat('?')
  if (p.is('(') || p.is('<')) {
    const method = signature(p, start)
    return {
      kind: 'field',
      start,
      end: method.end,
      value: key,
      left: method,
      flag: optional ? 'optional' : readonly ? 'readonly' : undefined,
    }
  }
  if (!p.eat(':')) return { kind: 'field', start, end: p.pos, value: key, flag: optional ? 'optional' : readonly ? 'readonly' : undefined }
  const left = p.type()
  return { kind: 'field', start, end: left.end, value: key, left, flag: optional ? 'optional' : readonly ? 'readonly' : undefined }
}

/**
 * Parses a tuple: types between brackets, named or not.
 *
 * @param p - The parser read from
 * @returns The node
 */
export function tuple(p: TypeParser): TypeNode {
  const start = p.pos
  p.pos += 1
  const elements: TypeNode[] = []
  while (!p.is(']')) {
    elements.push(tupleMember(p))
    if (!p.eat(',')) break
  }
  p.expect(']')
  return { kind: 'tuple', start, end: p.pos, elements }
}

/**
 * Parses one tuple member: a type, or a label with a type.
 *
 * @param p - The parser read from
 * @returns The node
 */
function tupleMember(p: TypeParser): TypeNode {
  const start = p.posAfterSkip()
  const labelled = /^(?:\.\.\.)?[A-Za-z_$][\w$]*\??\s*:/.exec(p.text.slice(p.pos))
  if (labelled === null) return p.type()
  const variadic = p.eat('...')
  const label = p.name()
  const optional = p.eat('?')
  p.expect(':')
  const left = p.type()
  return { kind: 'member', start, end: left.end, value: label, left, flag: variadic ? 'variadic' : optional ? 'optional' : undefined }
}

/**
 * Parses a parenthesised type, or an arrow function type.
 *
 * @param p - The parser read from
 * @returns The node
 */
export function parenthesised(p: TypeParser): TypeNode {
  const start = p.pos
  if (looksLikeArrow(p)) return signature(p, start)
  p.pos += 1
  const left = p.type()
  p.expect(')')
  return { kind: 'parens', start, end: p.pos, left }
}

/**
 * Whether the parenthesis ahead opens an arrow function's parameters.
 *
 * @param p - The parser read from
 * @returns Whether a `=>` follows the matching parenthesis
 */
function looksLikeArrow(p: TypeParser): boolean {
  let depth = 0
  for (let at = p.pos; at < p.text.length; at += 1) {
    const char = p.text[at]
    if (char === '(' || char === '[' || char === '{' || char === '<') depth += 1
    else if (char === ')' || char === ']' || char === '}' || char === '>') {
      depth -= 1
      if (depth === 0) return /^\s*=>/.test(p.text.slice(at + 1))
    }
  }
  return false
}

/**
 * Parses a `function(...)` type.
 *
 * @param p - The parser read from
 * @returns The node
 */
export function functionType(p: TypeParser): TypeNode {
  const start = p.pos
  p.pos += 8
  p.expect('(')
  const elements = parameters(p, ')')
  let left: TypeNode | undefined
  if (p.eat(':')) left = p.type()
  return { kind: 'function', start, end: left === undefined ? p.pos : left.end, elements, left, flag: 'function' }
}

/**
 * Parses a `new (...) => T` constructor type.
 *
 * @param p - The parser read from
 * @returns The node
 */
export function constructorType(p: TypeParser): TypeNode {
  const start = p.pos
  p.pos += 3
  const node = signature(p, start)
  return { ...node, flag: 'constructor' }
}

/**
 * Parses an arrow signature: parameters, `=>`, the return type.
 *
 * @param p - The parser read from
 * @param start - Where the signature started
 * @returns The node
 */
export function signature(p: TypeParser, start: number): TypeNode {
  let typeParameters: TypeNode[] = []
  if (p.eat('<')) {
    typeParameters = [p.type()]
    while (p.eat(',')) typeParameters.push(p.type())
    p.expect('>')
  }
  p.expect('(')
  const elements = parameters(p, ')')
  let left: TypeNode | undefined
  if (p.eat('=>') || p.eat(':')) left = p.type()
  return {
    kind: 'function',
    start,
    end: left === undefined ? p.pos : left.end,
    elements: [...typeParameters, ...elements],
    left,
    flag: 'arrow',
  }
}

/**
 * Parses parameters up to a closing character.
 *
 * @param p - The parser read from
 * @param close - The character ending them
 * @returns The parameter nodes
 */
function parameters(p: TypeParser, close: string): TypeNode[] {
  const elements: TypeNode[] = []
  while (!p.is(close)) {
    elements.push(parameter(p))
    if (!p.eat(',')) break
  }
  p.expect(close)
  return elements
}

/**
 * Parses one parameter: a named one with its type, a rest one, or a bare type.
 *
 * @param p - The parser read from
 * @returns The node
 */
function parameter(p: TypeParser): TypeNode {
  const start = p.posAfterSkip()
  const variadic = p.eat('...')
  // why: a bare `...` stands for any further parameters.
  if (variadic && (p.is(')') || p.is(','))) return { kind: 'variadic', start, end: p.pos }
  const named = /^[A-Za-z_$][\w$]*\??\s*:/.exec(p.text.slice(p.pos))
  if (named === null) {
    const left = p.type()
    return variadic ? { kind: 'variadic', start, end: left.end, left } : left
  }
  const name = p.name()
  const optional = p.eat('?')
  p.expect(':')
  const left = p.type()
  return { kind: 'parameter', start, end: left.end, value: name, left, flag: variadic ? 'variadic' : optional ? 'optional' : undefined }
}

/**
 * Parses an `import('path')` type, with the qualifier that may follow it.
 *
 * @param p - The parser read from
 * @returns The node
 */
export function importType(p: TypeParser): TypeNode {
  const start = p.pos
  p.pos += 6
  p.expect('(')
  p.skip()
  const path = p.stringLiteral()
  p.expect(')')
  return { kind: 'import', start, end: p.pos, left: path }
}

/**
 * Parses a `module:` path.
 *
 * @param p - The parser read from
 * @returns The node
 */
export function modulePath(p: TypeParser): TypeNode {
  const start = p.pos
  p.pos += 7
  if (p.text[p.pos] === '"' || p.text[p.pos] === "'") {
    const literal = p.stringLiteral()
    return { kind: 'name', start, end: literal.end, value: `module:${literal.value as string}` }
  }
  const parts = [p.name()]
  while (p.text[p.pos] === '/') {
    p.pos += 1
    parts.push(p.name())
  }
  return { kind: 'name', start, end: p.pos, value: `module:${parts.join('/')}` }
}
