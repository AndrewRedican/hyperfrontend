/**
 * The TypeScript type grammar: conditional types over unions over intersections over type
 * operators over postfix array and indexed-access types, down to references, literals, tuples,
 * object types, mapped types, function and constructor types, queries, imports and templates.
 *
 * @module code/parse-types
 */

import type { Kind, Node } from './model'
import type { Parser } from './parser'
import type { Token } from './scanner'
import { parseNumberLiteral, parseStringLiteral, parseTemplate } from './literals'
import { parseParameters } from './parse-functions'
import { parseEntityName } from './parse-modules'
import { isMappedType, parseMappedType, parseTupleType, parseTypeLiteral } from './parse-type-members'

/** The keyword types by word. */
const KEYWORDS: Readonly<Record<string, Kind>> = {
  any: 'TSAnyKeyword',
  unknown: 'TSUnknownKeyword',
  never: 'TSNeverKeyword',
  void: 'TSVoidKeyword',
  undefined: 'TSUndefinedKeyword',
  null: 'TSNullKeyword',
  string: 'TSStringKeyword',
  number: 'TSNumberKeyword',
  boolean: 'TSBooleanKeyword',
  bigint: 'TSBigIntKeyword',
  symbol: 'TSSymbolKeyword',
  object: 'TSObjectKeyword',
  intrinsic: 'TSIntrinsicKeyword',
}

/**
 * Parses a type annotation, from its colon, a type predicate included.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a type predicate annotation
 * ```ts
 * const node = parseTypeAnnotation(new Parser(': value is string', '.ts'))
 * node.typeAnnotation.kind // => 'TSTypePredicate'
 * node.typeAnnotation.parameterName.name // => 'value'
 * ```
 */
export function parseTypeAnnotation(p: Parser): Node {
  const start = p.token.start
  p.expect(':')
  const typeAnnotation = parsePredicateOrType(p)
  return p.node('TSTypeAnnotation', start, { typeAnnotation })
}

/**
 * Parses a type, or the predicate forms a return type may take: `x is T`, `asserts x`,
 * `asserts x is T`, `this is T`.
 *
 * @param p - The parser
 * @returns The node built
 */
function parsePredicateOrType(p: Parser): Node {
  const start = p.token.start
  if (p.isWordFollowedBy('asserts', (after) => after.kind === 'name')) {
    p.next()
    const parameterName = parsePredicateName(p)
    const typeAnnotation = p.eatWord('is') ? annotationOf(p, p.token.start, parseType(p)) : null
    return p.node('TSTypePredicate', start, { parameterName, typeAnnotation, asserts: true })
  }
  if (
    (p.isWord('this') || p.isIdentifier()) &&
    p.isWordFollowedBy(p.token.value, (after) => after.kind === 'name' && after.value === 'is')
  ) {
    const parameterName = parsePredicateName(p)
    p.next()
    const typeAnnotation = annotationOf(p, p.token.start, parseType(p))
    return p.node('TSTypePredicate', start, { parameterName, typeAnnotation, asserts: false })
  }
  return parseType(p)
}

/**
 * Wraps a type in an annotation node, as a predicate carries its type.
 *
 * @param p - The parser
 * @param start - The offset the type starts at
 * @param typeAnnotation - The type the annotation wraps
 * @returns The node built
 */
function annotationOf(p: Parser, start: number, typeAnnotation: Node): Node {
  return p.node('TSTypeAnnotation', start, { typeAnnotation })
}

/**
 * Parses the name a predicate is about: an identifier or `this`.
 *
 * @param p - The parser
 * @returns The node built
 */
function parsePredicateName(p: Parser): Node {
  if (p.isWord('this')) {
    const token = p.next()
    return p.node('TSThisType', token.start)
  }
  return p.identifier()
}

/**
 * Parses a type.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a conditional type
 * ```ts
 * const node = parseType(new Parser('T extends string ? Name<T> : never', '.ts'))
 * node.kind // => 'TSConditionalType'
 * node.falseType.kind // => 'TSNeverKeyword'
 * ```
 */
export function parseType(p: Parser): Node {
  const start = p.token.start
  const checkType = parseUnion(p)
  if (!p.isWord('extends') || p.token.newlineBefore) return checkType
  p.next()
  const extendsType = parseUnion(p, true)
  p.expect('?')
  const trueType = parseType(p)
  p.expect(':')
  const falseType = parseType(p)
  return p.node('TSConditionalType', start, { checkType, extendsType, trueType, falseType })
}

/**
 * Parses a union type.
 *
 * @param p - The parser
 * @param inExtends - Whether the type is the extends clause of a conditional, where an infer type takes no constraint
 * @returns The node built
 */
function parseUnion(p: Parser, inExtends = false): Node {
  const start = p.token.start
  const leading = p.eat('|')
  const types = [parseIntersection(p, inExtends)]
  while (p.eat('|')) types.push(parseIntersection(p, inExtends))
  return types.length === 1 && !leading ? types[0] : p.node('TSUnionType', start, { types })
}

/**
 * Parses an intersection type.
 *
 * @param p - The parser
 * @param inExtends - Whether the type is the extends clause of a conditional
 * @returns The node built
 */
function parseIntersection(p: Parser, inExtends: boolean): Node {
  const start = p.token.start
  const leading = p.eat('&')
  const types = [parseTypeOperator(p, inExtends)]
  while (p.eat('&')) types.push(parseTypeOperator(p, inExtends))
  return types.length === 1 && !leading ? types[0] : p.node('TSIntersectionType', start, { types })
}

/**
 * Parses a type operator: `keyof`, `unique`, `readonly` or `infer`, or a postfix type.
 *
 * @param p - The parser
 * @param inExtends - Whether the type is the extends clause of a conditional
 * @returns The node built
 */
function parseTypeOperator(p: Parser, inExtends: boolean): Node {
  const start = p.token.start
  if (
    p.token.kind === 'name' &&
    ['keyof', 'unique', 'readonly'].includes(p.token.value) &&
    !p.peek().newlineBefore &&
    startsType(p.peek())
  ) {
    const operator = p.next().value
    const typeAnnotation = parseTypeOperator(p, inExtends)
    return p.node('TSTypeOperator', start, { operator, typeAnnotation })
  }
  if (p.isWordFollowedBy('infer', (after) => after.kind === 'name')) {
    p.next()
    const nameStart = p.token.start
    const name = p.identifier()
    let constraint: Node | undefined
    if (p.isWord('extends') && inExtends) {
      // why: inside the extends clause of a conditional type the constraint is always a constraint, since no nested conditional may start there.
      p.next()
      constraint = parseUnion(p, true)
    } else if (p.isWord('extends')) {
      const tried = p.tryParse(() => {
        p.next()
        const type = parseUnion(p, true)
        if (p.is('?')) p.fail('Conditional type.')
        return type
      })
      constraint = tried ?? undefined
    }
    const typeParameter = p.node('TSTypeParameter', nameStart, { name, constraint, in: false, out: false, const: false })
    return p.node('TSInferType', start, { typeParameter })
  }
  return parsePostfixType(p)
}

/**
 * Whether a token can begin a type.
 *
 * @param token - The token to inspect
 * @returns True when it can
 */
function startsType(token: Token): boolean {
  if (token.kind === 'name' || token.kind === 'string' || token.kind === 'number' || token.kind === 'template') return true
  return token.kind === 'punct' && ['(', '[', '{', '<', '-', '|', '&', '...'].includes(token.value)
}

/**
 * Parses a primary type with its array and indexed-access suffixes.
 *
 * @param p - The parser
 * @returns The node built
 */
function parsePostfixType(p: Parser): Node {
  const start = p.token.start
  let type = parsePrimaryType(p)
  while (p.is('[') && !p.token.newlineBefore) {
    p.next()
    if (p.eat(']')) {
      type = p.node('TSArrayType', start, { elementType: type })
      continue
    }
    const indexType = parseType(p)
    p.expect(']')
    type = p.node('TSIndexedAccessType', start, { objectType: type, indexType })
  }
  return type
}

/**
 * Parses a primary type.
 *
 * @param p - The parser
 * @returns The node built
 */
function parsePrimaryType(p: Parser): Node {
  const token = p.token
  const start = token.start
  switch (token.kind) {
    case 'string':
      return literalType(p, start, parseStringLiteral(p))
    case 'number':
      return literalType(p, start, parseNumberLiteral(p))
    case 'template':
      return parseTemplate(p, () => parseType(p), 'TSTemplateLiteralType')
    case 'punct':
      return parsePunctuatedType(p)
    case 'name':
      break
    default:
      p.fail('Type expected.')
  }
  const keyword = KEYWORDS[token.value]
  if (keyword !== undefined && !(p.peek().kind === 'punct' && p.peek().value === '.' && !p.peek().newlineBefore)) {
    p.next()
    return p.node(keyword, start)
  }
  switch (token.value) {
    case 'this':
      p.next()
      return p.node('TSThisType', start)
    case 'true':
    case 'false': {
      p.next()
      const literal = p.node('Literal', start, { value: token.value === 'true', raw: token.value })
      return p.node('TSLiteralType', start, { literal })
    }
    case 'typeof':
      return parseTypeQuery(p)
    case 'import':
      return parseImportType(p)
    case 'new':
      return parseFunctionType(p, start, 'TSConstructorType', false)
    case 'abstract':
      if (p.peek().kind === 'name' && p.peek().value === 'new') {
        p.next()
        return parseFunctionType(p, start, 'TSConstructorType', true)
      }
      break
    default:
      break
  }
  const typeName = parseEntityName(p)
  const typeArguments = p.is('<') && !p.token.newlineBefore ? parseTypeArguments(p) : undefined
  return p.node('TSTypeReference', start, { typeName, typeArguments })
}

/**
 * Wraps a literal in a literal type.
 *
 * @param p - The parser
 * @param start - The offset the literal starts at
 * @param literal - The literal the type wraps
 * @returns The node built
 */
function literalType(p: Parser, start: number, literal: Node): Node {
  return p.node('TSLiteralType', start, { literal })
}

/**
 * Parses a type that opens with punctuation: a parenthesis, a tuple, an object or mapped type,
 * a generic function type or a negative number.
 *
 * @param p - The parser
 * @returns The node built
 */
function parsePunctuatedType(p: Parser): Node {
  const token = p.token
  const start = token.start
  switch (token.value) {
    case '(': {
      const functionType = p.tryParse(() => parseFunctionType(p, start, 'TSFunctionType', false))
      if (functionType !== null) return functionType
      p.next()
      const type = parseType(p)
      p.expect(')')
      return type
    }
    case '<':
      return parseFunctionType(p, start, 'TSFunctionType', false)
    case '[':
      return parseTupleType(p)
    case '{':
      return isMappedType(p) ? parseMappedType(p) : parseTypeLiteral(p)
    case '-': {
      p.next()
      if (p.token.kind !== 'number') p.fail('Type expected.')
      const argument = parseNumberLiteral(p)
      const literal = p.node('UnaryExpression', start, { operator: '-', prefix: true, argument })
      return p.node('TSLiteralType', start, { literal })
    }
    default:
      return p.fail('Type expected.')
  }
}

/**
 * Parses a function or constructor type.
 *
 * @param p - The parser
 * @param start - The offset the type starts at
 * @param kind - A function type or a constructor type
 * @param abstract - Whether a constructor type is abstract
 * @returns The node built
 */
function parseFunctionType(p: Parser, start: number, kind: 'TSFunctionType' | 'TSConstructorType', abstract: boolean): Node {
  if (kind === 'TSConstructorType') p.expectWord('new')
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  const params = parseParameters(p)
  const returnStart = p.token.start
  p.expect('=>')
  const returnType = annotationOf(p, returnStart, parsePredicateOrType(p))
  return p.node(
    kind,
    start,
    kind === 'TSFunctionType' ? { typeParameters, params, returnType } : { typeParameters, params, returnType, abstract }
  )
}

/**
 * Parses a type query: `typeof` an entity name or import type, with type arguments.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseTypeQuery(p: Parser): Node {
  const start = p.next().start
  const exprName = p.isWord('import') ? parseImportType(p) : p.isWord('this') ? parseThisName(p) : parseEntityName(p)
  const typeArguments = p.is('<') && !p.token.newlineBefore ? parseTypeArguments(p) : undefined
  return p.node('TSTypeQuery', start, { exprName, typeArguments })
}

/**
 * Parses `this` and the names after it, as a type query names them.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseThisName(p: Parser): Node {
  const start = p.next().start
  let name = p.node('ThisExpression', start)
  while (p.is('.')) {
    p.next()
    const right = p.propertyName()
    name = p.node('TSQualifiedName', start, { left: name, right })
  }
  return name
}

/**
 * Parses an import type: `import('x').A.B<T>`.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseImportType(p: Parser): Node {
  const start = p.next().start
  p.expect('(')
  const argument = parseStringLiteral(p)
  p.expect(')')
  let qualifier: Node | null = null
  if (p.eat('.')) {
    const qualifierStart = p.token.start
    qualifier = p.propertyName()
    while (p.is('.')) {
      p.next()
      const right = p.propertyName()
      qualifier = p.node('TSQualifiedName', qualifierStart, { left: qualifier, right })
    }
  }
  const typeArguments = p.is('<') ? parseTypeArguments(p) : undefined
  return p.node('TSImportType', start, { argument, qualifier, typeArguments })
}

/**
 * Parses type arguments, from their `<`.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse type arguments
 * ```ts
 * const { params } = parseTypeArguments(new Parser('<string, User[]>', '.ts'))
 * params.map((param) => param.kind)
 * // => ['TSStringKeyword', 'TSArrayType']
 * ```
 */
export function parseTypeArguments(p: Parser): Node {
  const start = p.token.start
  p.expect('<')
  const params: Node[] = []
  while (!p.is('>')) {
    params.push(parseType(p))
    if (!p.is('>')) p.expect(',')
  }
  if (params.length === 0) p.fail('Type argument list cannot be empty.')
  p.expect('>')
  return p.node('TSTypeParameterInstantiation', start, { params })
}

/**
 * Parses type parameters, from their `<`.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a const type parameter with a constraint and default
 * ```ts
 * const p = new Parser('<const T extends string = "id">', '.ts')
 * const [param] = parseTypeParameters(p).params
 * param.const // => true
 * param.constraint.kind // => 'TSStringKeyword'
 * param.default.kind // => 'TSLiteralType'
 * ```
 */
export function parseTypeParameters(p: Parser): Node {
  const start = p.token.start
  p.expect('<')
  const params: Node[] = []
  while (!p.is('>')) {
    const parameterStart = p.token.start
    let isConst = false
    let isIn = false
    let isOut = false
    for (;;) {
      if (p.isWordFollowedBy('const', (after) => after.kind === 'name')) {
        p.next()
        isConst = true
      } else if (p.isWordFollowedBy('in', (after) => after.kind === 'name')) {
        p.next()
        isIn = true
      } else if (p.isWordFollowedBy('out', (after) => after.kind === 'name')) {
        p.next()
        isOut = true
      } else break
    }
    const name = p.identifier()
    const constraint = p.eatWord('extends') ? parseType(p) : undefined
    const defaultType = p.eat('=') ? parseType(p) : undefined
    params.push(p.node('TSTypeParameter', parameterStart, { name, constraint, default: defaultType, in: isIn, out: isOut, const: isConst }))
    if (!p.is('>')) p.expect(',')
  }
  if (params.length === 0) p.fail('Type parameter list cannot be empty.')
  p.expect('>')
  return p.node('TSTypeParameterDeclaration', start, { params })
}
