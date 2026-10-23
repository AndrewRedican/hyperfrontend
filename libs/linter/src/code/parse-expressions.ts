/**
 * Expressions: assignment and arrows at the top, conditionals, binary operators by precedence,
 * unary and postfix operators, and the primary expressions; the member and call chains between
 * them live in the members module.
 *
 * @module code/parse-expressions
 */

import type { Draft, Node } from './model'
import type { Parser } from './parser'
import { parseKeywordLiteral, parseNumberLiteral, parseRegexLiteral, parseStringLiteral, parseTemplate } from './literals'
import { parseClass } from './parse-classes'
import { parseArrowFromParenthesis, parseFunctionExpression, parseObjectLiteral, toPattern } from './parse-functions'
import { parseJsxElement } from './parse-jsx'
import { parseLeftHandSide, parsePrivateName, parseSpread } from './parse-members'
import { markDirectives, parseDecorators, parseStatement } from './parse-statements'
import { parseType, parseTypeArguments } from './parse-types'

/** The binary operators by precedence, higher binding tighter. */
const PRECEDENCE: Readonly<Record<string, number>> = {
  '??': 1,
  '||': 2,
  '&&': 3,
  '|': 4,
  '^': 5,
  '&': 6,
  '==': 7,
  '!=': 7,
  '===': 7,
  '!==': 7,
  '<': 8,
  '>': 8,
  '<=': 8,
  '>=': 8,
  instanceof: 8,
  in: 8,
  as: 8,
  satisfies: 8,
  '<<': 9,
  '>>': 9,
  '>>>': 9,
  '+': 10,
  '-': 10,
  '*': 11,
  '/': 11,
  '%': 11,
  '**': 12,
}

/** The assignment operators. */
const ASSIGNMENT = ['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=']

/**
 * Parses an expression, commas included.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a comma-separated expression
 * ```ts
 * const node = parseExpression(new Parser('retries++, done = true', '.ts'))
 * node.kind // => 'SequenceExpression'
 * node.expressions.map((part) => part.kind)
 * // => ['UpdateExpression', 'AssignmentExpression']
 * ```
 */
export function parseExpression(p: Parser): Node {
  const start = p.token.start
  const first = parseAssignment(p)
  if (!p.is(',')) return first
  const expressions = [first]
  while (p.eat(',')) expressions.push(parseAssignment(p))
  return p.node('SequenceExpression', start, { expressions })
}

/**
 * Parses an assignment expression: an arrow function, a yield, or a conditional expression
 * possibly assigned to.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse an async arrow function
 * ```ts
 * const node = parseAssignment(new Parser('async (id) => load(id)', '.ts'))
 * node.kind // => 'ArrowFunctionExpression'
 * node.async // => true
 * node.body.kind // => 'CallExpression'
 * ```
 */
export function parseAssignment(p: Parser): Node {
  const start = p.token.start
  // why: outside a generator, a `yield` that an identifier or literal follows on the same line is still read as a yield, as the compiler reads it.
  if (
    p.isWord('yield') &&
    (p.inGenerator || p.isWordFollowedBy('yield', (after) => after.kind === 'name' || after.kind === 'number' || after.kind === 'string'))
  ) {
    return parseYield(p)
  }
  const arrow = tryArrow(p)
  if (arrow !== null) return arrow
  const left = parseConditional(p)
  if (p.token.kind !== 'punct' || !ASSIGNMENT.includes(p.token.value)) return left
  const operator = p.next().value
  const target = operator === '=' ? toPattern(p, left) : left
  if (target.kind !== 'Identifier' && target.kind !== 'MemberExpression' && operator !== '=' && !isTsWrapped(target)) {
    p.fail('The left-hand side of an assignment expression must be a variable or a property access.', left.start)
  }
  const right = parseAssignment(p)
  return p.node('AssignmentExpression', start, { operator, left: target, right })
}

/**
 * Whether a node is an assignable expression wrapped in a TypeScript assertion.
 *
 * @param node - The node to read
 * @returns True for `x!` or `x as T` around an assignable expression
 */
function isTsWrapped(node: Node): boolean {
  return (
    node.kind === 'TSNonNullExpression' ||
    node.kind === 'TSAsExpression' ||
    node.kind === 'TSSatisfiesExpression' ||
    node.kind === 'TSTypeAssertion'
  )
}

/**
 * Tries the arrow function forms: `x =>`, `async x =>`, `(…) =>`, `async (…) =>`, `<T>(…) =>`.
 *
 * @param p - The parser
 * @returns The arrow, or null when the expression is no arrow
 */
function tryArrow(p: Parser): Node | null {
  const token = p.token
  if (token.kind === 'name' && p.isIdentifier(token) && token.value !== 'async') {
    const after = p.peek()
    if (after.kind === 'punct' && after.value === '=>' && !after.newlineBefore) return parseArrowFromIdentifier(p, false)
    return null
  }
  if (p.isWord('async')) {
    const after = p.peek()
    if (after.newlineBefore) return null
    if (after.kind === 'name' && after.value !== 'function') {
      const state = p.save()
      p.next()
      if (p.isIdentifier() && p.peek().kind === 'punct' && p.peek().value === '=>') return parseArrowFromIdentifier(p, true)
      p.restore(state)
      return null
    }
    if (after.kind === 'punct' && (after.value === '(' || after.value === '<')) {
      return attemptArrow(p, true, () => {
        const start = p.next().start
        return parseArrowFromParenthesis(p, start, true)
      })
    }
    return null
  }
  if (p.is('(') || p.is('<')) return attemptArrow(p, false, () => parseArrowFromParenthesis(p, token.start, false))
  return null
}

/**
 * Tries an arrow function at the current token, unless one already failed there in the same
 * context: nested parentheses would otherwise retry every inner attempt once per outer one.
 *
 * @param p - The parser
 * @param async - Whether `async` came before
 * @param parse - Parses the arrow function from the current token, throwing on a syntax failure
 * @returns The node built, or null when the text is no arrow function
 */
function attemptArrow(p: Parser, async: boolean, parse: () => Node): Node | null {
  const key = `${p.token.start}:${async}:${p.inAsync}:${p.inGenerator}:${p.noIn}:${p.ambient}`
  if (p.failedArrows.has(key)) return null
  const node = p.tryParse(parse)
  if (node === null) p.failedArrows.add(key)
  return node
}

/**
 * Parses an arrow function whose single parameter is an identifier.
 *
 * @param p - The parser
 * @param async - Whether `async` came before
 * @returns The node built
 */
function parseArrowFromIdentifier(p: Parser, async: boolean): Node {
  const start = async ? p.lastEnd - 5 : p.token.start
  const param = p.identifier()
  p.expect('=>')
  return finishArrow(p, start, [param], async, undefined, undefined)
}

/**
 * Parses an arrow function's body and builds the node.
 *
 * @param p - The parser
 * @param start - The offset the arrow started at
 * @param params - Its parameters
 * @param async - Whether it is async
 * @param typeParameters - Its type parameters
 * @param returnType - Its return type
 * @returns The node built
 *
 * @example Finish an arrow once its parameter and arrow are consumed
 * ```ts
 * const p = new Parser('value => value * 2', '.ts')
 * const param = p.identifier()
 * p.expect('=>')
 * const arrow = finishArrow(p, 0, [param], false, undefined, undefined)
 * arrow.expression // => true
 * arrow.body.kind // => 'BinaryExpression'
 * ```
 */
export function finishArrow(
  p: Parser,
  start: number,
  params: Node[],
  async: boolean,
  typeParameters: Node | undefined,
  returnType: Node | undefined
): Node {
  const outer = { inAsync: p.inAsync, inGenerator: p.inGenerator, noIn: p.noIn }
  p.inAsync = async
  p.inGenerator = false
  p.noIn = false
  const expression = !p.is('{')
  const body = expression ? parseAssignment(p) : parseFunctionBody(p)
  p.inAsync = outer.inAsync
  p.inGenerator = outer.inGenerator
  p.noIn = outer.noIn
  return p.node('ArrowFunctionExpression', start, { params, body, async, expression, generator: false, typeParameters, returnType })
}

/**
 * Parses a block as a function body.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a body that opens with a directive
 * ```ts
 * const p = new Parser("{ 'use strict'; return 1 }", '.ts')
 * parseFunctionBody(p).body.map((statement) => statement.directive)
 * // => ['use strict', undefined]
 * ```
 */
export function parseFunctionBody(p: Parser): Node {
  const start = p.token.start
  p.expect('{')
  const body: Node[] = []
  while (!p.is('}')) body.push(parseStatement(p))
  p.expect('}')
  markDirectives(body)
  return p.node('BlockStatement', start, { body })
}

/**
 * Parses a yield expression.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseYield(p: Parser): Node {
  const start = p.next().start
  const delegate = !p.token.newlineBefore && p.eat('*')
  const token = p.token
  const startsArgument =
    !token.newlineBefore && !(token.kind === 'punct' && [')', ']', '}', ',', ';', ':'].includes(token.value)) && token.kind !== 'eof'
  const argument = delegate || startsArgument ? parseAssignment(p) : null
  return p.node('YieldExpression', start, { argument, delegate })
}

/**
 * Parses a conditional expression.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseConditional(p: Parser): Node {
  const start = p.token.start
  const test = parseBinary(p, 0)
  if (!p.is('?')) return test
  p.next()
  const noIn = p.noIn
  p.noIn = false
  const consequent = parseAssignment(p)
  p.noIn = noIn
  p.expect(':')
  const alternate = parseAssignment(p)
  return p.node('ConditionalExpression', start, { test, consequent, alternate })
}

/**
 * The binary operator the current token is, rescanning a greater-than.
 *
 * @param p - The parser
 * @returns The operator, or null
 */
function binaryOperator(p: Parser): string | null {
  const token = p.token
  if (token.kind === 'punct') {
    if (token.value === '>') p.scanner.rescanGreater()
    const operator = p.token.value
    return PRECEDENCE[operator] === undefined || operator === 'in' || operator === 'instanceof' ? null : operator
  }
  if (token.kind !== 'name') return null
  if (token.value === 'instanceof' || (token.value === 'in' && !p.noIn)) return token.value
  if ((token.value === 'as' || token.value === 'satisfies') && !token.newlineBefore) return token.value
  return null
}

/**
 * Parses binary operators above a precedence, by precedence climbing.
 *
 * @param p - The parser
 * @param minimum - The precedence the operators must exceed
 * @returns The node built
 */
function parseBinary(p: Parser, minimum: number): Node {
  const start = p.token.start
  let left = parseUnary(p)
  for (;;) {
    const operator = binaryOperator(p)
    if (operator === null) return left
    const precedence = PRECEDENCE[operator]
    if (precedence <= minimum && !(operator === '**' && precedence === minimum)) return left
    p.next()
    if (operator === 'as' || operator === 'satisfies') {
      const typeAnnotation = p.isWord('const') && operator === 'as' ? parseConstAssertion(p) : parseType(p)
      left = p.node(operator === 'as' ? 'TSAsExpression' : 'TSSatisfiesExpression', start, { expression: left, typeAnnotation })
      continue
    }
    const right = operator === '**' ? parseBinary(p, precedence - 1) : parseBinary(p, precedence)
    const kind = operator === '&&' || operator === '||' || operator === '??' ? 'LogicalExpression' : 'BinaryExpression'
    left = p.node(kind, start, { operator, left, right })
  }
}

/**
 * Parses the `const` of `as const` as a type reference.
 *
 * @param p - The parser
 * @returns The reference named `const`
 */
function parseConstAssertion(p: Parser): Node {
  const token = p.next()
  let typeName = p.node('Identifier', token.start, { name: 'const' })
  // why: the compiler reads `const` as any other type name here, so a qualified name and type arguments may follow it.
  while (p.is('.')) {
    p.next()
    const right = p.propertyName()
    typeName = p.node('TSQualifiedName', token.start, { left: typeName, right })
  }
  const typeArguments = p.is('<') ? parseTypeArguments(p) : undefined
  return p.node('TSTypeReference', token.start, { typeName, typeArguments })
}

/**
 * Parses a unary expression.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseUnary(p: Parser): Node {
  const token = p.token
  const start = token.start
  if (token.kind === 'punct') {
    if (token.value === '++' || token.value === '--') {
      p.next()
      const argument = parseUnary(p)
      return p.node('UpdateExpression', start, { operator: token.value, prefix: true, argument })
    }
    if (token.value === '+' || token.value === '-' || token.value === '~' || token.value === '!') {
      p.next()
      const argument = parseUnary(p)
      return p.node('UnaryExpression', start, { operator: token.value, prefix: true, argument })
    }
    if (token.value === '<' && !p.jsx) {
      p.next()
      const typeAnnotation = p.isWord('const') ? parseConstAssertion(p) : parseType(p)
      p.expect('>')
      const expression = parseUnary(p)
      return p.node('TSTypeAssertion', start, { typeAnnotation, expression })
    }
  } else if (token.kind === 'name') {
    if (token.value === 'delete' || token.value === 'void' || token.value === 'typeof') {
      p.next()
      const argument = parseUnary(p)
      return p.node('UnaryExpression', start, { operator: token.value, prefix: true, argument })
    }
    // why: a module is an await context throughout, so `await` opens an await expression wherever an expression may start.
    if (token.value === 'await') {
      p.next()
      const argument = parseUnary(p)
      return p.node('AwaitExpression', start, { argument })
    }
  }
  return parsePostfix(p)
}

/**
 * Parses a postfix expression: a left-hand side with an optional `++` or `--`.
 *
 * @param p - The parser
 * @returns The node built
 */
function parsePostfix(p: Parser): Node {
  const start = p.token.start
  const argument = parseLeftHandSide(p)
  if ((p.is('++') || p.is('--')) && !p.token.newlineBefore) {
    const operator = p.next().value
    return p.node('UpdateExpression', start, { operator, prefix: false, argument })
  }
  return argument
}

/**
 * Parses a primary expression.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse only the primary part of a member access
 * ```ts
 * const p = new Parser('this.count', '.ts')
 * parsePrimary(p).kind // => 'ThisExpression'
 * p.token.value // => '.' (the member access is left to the caller)
 * ```
 */
export function parsePrimary(p: Parser): Node {
  const token = p.token
  const start = token.start
  switch (token.kind) {
    case 'number':
      return parseNumberLiteral(p)
    case 'string':
      return parseStringLiteral(p)
    case 'template':
      return parseTemplate(p, () => parseExpression(p), 'TemplateLiteral')
    case 'private':
      return parsePrivateName(p)
    case 'punct':
      return parsePunctuatedPrimary(p)
    case 'name':
      break
    default:
      p.fail('Expression expected.')
  }
  switch (token.value) {
    case 'this':
      p.next()
      return p.node('ThisExpression', start)
    case 'true':
    case 'false':
    case 'null':
      return parseKeywordLiteral(p)
    case 'function':
      return parseFunctionExpression(p, false)
    case 'class':
      return parseClass(p, [], true)
    case 'async':
      if (p.isWordFollowedBy('async', (after) => after.kind === 'name' && after.value === 'function')) {
        p.next()
        return parseFunctionExpression(p, true)
      }
      break
    default:
      break
  }
  return p.identifier()
}

/**
 * Parses a primary expression that opens with punctuation: a parenthesis, an array, an object,
 * a regular expression, a decorated class or JSX.
 *
 * @param p - The parser
 * @returns The node built
 */
function parsePunctuatedPrimary(p: Parser): Node {
  const token = p.token
  switch (token.value) {
    case '(': {
      p.next()
      const noIn = p.noIn
      p.noIn = false
      const expression = parseExpression(p)
      p.noIn = noIn
      p.expect(')')
      return expression
    }
    case '[':
      return parseArrayLiteral(p)
    case '{':
      return parseObjectLiteral(p)
    case '/':
    case '/=':
      p.scanner.rescanSlash()
      return parseRegexLiteral(p)
    case '@': {
      const decorators = parseDecorators(p)
      return parseClass(p, decorators, true)
    }
    case '<':
      return parseJsxElement(p)
    default:
      return p.fail('Expression expected.')
  }
}

/**
 * Parses an array literal.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseArrayLiteral(p: Parser): Node {
  const start = p.next().start
  const elements: (Node | null)[] = []
  while (!p.is(']')) {
    if (p.is(',')) {
      p.next()
      elements.push(null)
      continue
    }
    elements.push(p.is('...') ? parseSpread(p) : parseAssignment(p))
    if (!p.is(']')) p.expect(',')
  }
  p.expect(']')
  return p.node('ArrayExpression', start, { elements })
}

/**
 * A draft of a node, for the few places a field is filled in after construction.
 *
 * @param node - The node to read
 * @returns The same node, writable
 *
 * @example Fill in a field after building a node
 * ```ts
 * const p = new Parser('key: string', '.ts')
 * const key = p.identifier()
 * draft(key).typeAnnotation = parseTypeAnnotation(p)
 * key.typeAnnotation.kind // => 'TSTypeAnnotation'
 * ```
 */
export function draft(node: Node): Draft {
  return node as Draft
}
