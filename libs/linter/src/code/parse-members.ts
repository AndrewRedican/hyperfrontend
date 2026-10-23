/**
 * The left-hand side of an expression: `new`, `super`, `import`, and the chain of member
 * accesses, calls, optional chains, tagged templates, non-null assertions and type arguments
 * after a primary expression.
 *
 * @module code/parse-members
 */

import type { Node } from './model'
import type { Parser } from './parser'
import { parseTemplate } from './literals'
import { parseAssignment, parseExpression, parsePrimary } from './parse-expressions'
import { parseTypeArguments } from './parse-types'

/** The tokens after which type arguments in an expression are taken as such. */
/** The word operators that may follow type arguments, which then instantiate rather than compare. */
const WORD_OPERATORS = ['as', 'satisfies', 'in', 'instanceof']

const AFTER_TYPE_ARGUMENTS = [
  '(',
  '`',
  '.',
  '?.',
  ')',
  ']',
  ':',
  ';',
  ',',
  '?',
  '==',
  '===',
  '!=',
  '!==',
  '&&',
  '||',
  '??',
  '^',
  '&',
  '|',
  '}',
]

/**
 * Parses a left-hand-side expression: `new`, `super`, `import`, calls and members.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse an optional chain
 * ```ts
 * const node = parseLeftHandSide(new Parser('user?.profile.name', '.ts'))
 * node.kind // => 'ChainExpression'
 * node.expression.object.optional // => true
 * ```
 */
export function parseLeftHandSide(p: Parser): Node {
  const start = p.token.start
  let expression: Node
  if (p.isWord('new')) expression = parseNew(p)
  else if (p.isWord('super')) {
    p.next()
    expression = p.node('Super', start)
  } else if (p.isWord('import') && p.peek().kind === 'punct' && (p.peek().value === '(' || p.peek().value === '.'))
    expression = parseImportExpression(p)
  else expression = parsePrimary(p)
  return parseMemberChain(p, expression, start, true)
}

/**
 * Parses `import(…)` and `import.meta`.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseImportExpression(p: Parser): Node {
  const start = p.next().start
  if (p.eat('.')) {
    const property = p.propertyName()
    const meta = p.node('Identifier', start, { name: 'import' })
    meta.end = start + 6
    return p.node('MetaProperty', start, { meta, property })
  }
  p.expect('(')
  const source = parseAssignment(p)
  let options: Node | null = null
  if (p.eat(',') && !p.is(')')) {
    options = parseAssignment(p)
    p.eat(',')
  }
  p.expect(')')
  return p.node('ImportExpression', start, { source, options })
}

/**
 * Parses a `new` expression, `new.target` included.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseNew(p: Parser): Node {
  const start = p.next().start
  if (p.eat('.')) {
    const property = p.propertyName()
    const meta = p.node('Identifier', start, { name: 'new' })
    meta.end = start + 3
    return p.node('MetaProperty', start, { meta, property })
  }
  const calleeStart = p.token.start
  const primary = p.isWord('new') ? parseNew(p) : p.isWord('super') ? parseSuper(p) : parsePrimary(p)
  const callee = parseMemberChain(p, primary, calleeStart, false)
  const typeArguments = p.is('<') ? (p.tryParse(() => parseTypeArguments(p)) ?? undefined) : undefined
  const args = p.is('(') ? parseArguments(p) : []
  return p.node('NewExpression', start, { callee, arguments: args, typeArguments })
}

/**
 * Parses `super`.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseSuper(p: Parser): Node {
  const token = p.next()
  return p.node('Super', token.start)
}

/**
 * Parses the member accesses, calls, tagged templates, non-null assertions and type arguments
 * after an expression, wrapping the result in a chain expression when a `?.` appeared.
 *
 * @param p - The parser
 * @param expression - The expression accessed
 * @param start - Its offset
 * @param allowCalls - Whether calls are part of the chain
 * @returns The node built
 *
 * @example Stop the chain before a call
 * ```ts
 * const p = new Parser('config.load()', '.ts')
 * const node = parseMemberChain(p, p.identifier(), 0, false)
 * node.kind // => 'MemberExpression'
 * p.token.value // => '(' (left for the caller)
 * ```
 */
export function parseMemberChain(p: Parser, expression: Node, start: number, allowCalls: boolean): Node {
  let chained = false
  for (;;) {
    const token = p.token
    if (token.kind === 'template') {
      if (chained) p.fail('Tagged template expressions are not permitted in an optional chain.')
      const quasi = parseTemplate(p, () => parseExpression(p), 'TemplateLiteral')
      expression = p.node('TaggedTemplateExpression', start, { tag: expression, quasi })
      continue
    }
    if (token.kind !== 'punct') break
    let optional = false
    if (token.value === '?.') {
      p.next()
      optional = true
      chained = true
      if (p.is('(')) {
        if (!allowCalls) p.fail('Unexpected token.')
        const args = parseArguments(p)
        expression = p.node('CallExpression', start, { callee: expression, arguments: args, optional })
        continue
      }
      if (p.is('<')) {
        const typeArguments = parseTypeArguments(p)
        const args = parseArguments(p)
        expression = p.node('CallExpression', start, { callee: expression, arguments: args, optional, typeArguments })
        continue
      }
    } else if (token.value === '.') p.next()
    if (optional || token.value === '.') {
      if (p.is('[')) {
        p.next()
        const property = parseExpression(p)
        p.expect(']')
        expression = p.node('MemberExpression', start, { object: expression, property, computed: true, optional })
      } else {
        if (chained && p.token.kind === 'private') p.fail('An optional chain cannot contain private identifiers.')
        const property = p.token.kind === 'private' ? parsePrivateName(p) : p.propertyName()
        expression = p.node('MemberExpression', start, { object: expression, property, computed: false, optional })
      }
      continue
    }
    if (token.value === '[') {
      p.next()
      const property = parseExpression(p)
      p.expect(']')
      expression = p.node('MemberExpression', start, { object: expression, property, computed: true, optional: false })
      continue
    }
    if (token.value === '(' && allowCalls) {
      const args = parseArguments(p)
      expression = p.node('CallExpression', start, { callee: expression, arguments: args, optional: false })
      continue
    }
    if (token.value === '!' && !token.newlineBefore) {
      p.next()
      expression = p.node('TSNonNullExpression', start, { expression })
      continue
    }
    if (token.value === '<') {
      const instantiation = p.tryParse(() => {
        const typeArguments = parseTypeArgumentsInExpression(p)
        if (!allowCalls && p.is('(')) p.fail('The arguments belong to the new expression.')
        return typeArguments
      })
      if (instantiation === null) break
      if (p.is('(') && allowCalls) {
        const args = parseArguments(p)
        expression = p.node('CallExpression', start, { callee: expression, arguments: args, optional: false, typeArguments: instantiation })
      } else if (p.token.kind === 'template') {
        const quasi = parseTemplate(p, () => parseExpression(p), 'TemplateLiteral')
        expression = p.node('TaggedTemplateExpression', start, { tag: expression, quasi, typeArguments: instantiation })
      } else expression = p.node('TSInstantiationExpression', start, { expression, typeArguments: instantiation })
      continue
    }
    break
  }
  return chained ? p.node('ChainExpression', start, { expression }) : expression
}

/**
 * Parses type arguments in an expression, accepting them only when what follows cannot continue
 * a comparison.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Accept type arguments only before a call or similar
 * ```ts
 * const p = new Parser('<string>(raw)', '.ts')
 * parseTypeArgumentsInExpression(p).kind // => 'TSTypeParameterInstantiation'
 * // '<limit> count' throws "Type arguments cannot be followed by that."
 * ```
 */
export function parseTypeArgumentsInExpression(p: Parser): Node {
  const typeArguments = parseTypeArguments(p)
  const token = p.token
  if (token.kind === 'punct' && AFTER_TYPE_ARGUMENTS.includes(token.value)) return typeArguments
  if (token.kind === 'name' && WORD_OPERATORS.includes(token.value)) return typeArguments
  if (token.kind === 'template' || token.kind === 'eof' || token.newlineBefore) return typeArguments
  return p.fail('Type arguments cannot be followed by that.')
}

/**
 * Parses a private name.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a private name without its hash
 * ```ts
 * parsePrivateName(new Parser('#cache', '.ts'))
 * // => { kind: 'PrivateIdentifier', name: 'cache', start: 0, end: 6, ... }
 * ```
 */
export function parsePrivateName(p: Parser): Node {
  const token = p.next()
  return p.node('PrivateIdentifier', token.start, { name: token.value.slice(1) })
}

/**
 * Parses the arguments of a call.
 *
 * @param p - The parser
 * @returns The nodes built, in source order
 *
 * @example Parse call arguments with a spread
 * ```ts
 * parseArguments(new Parser('(id, ...rest)', '.ts')).map((arg) => arg.kind)
 * // => ['Identifier', 'SpreadElement']
 * ```
 */
export function parseArguments(p: Parser): Node[] {
  p.expect('(')
  const noIn = p.noIn
  p.noIn = false
  const args: Node[] = []
  while (!p.is(')')) {
    args.push(p.is('...') ? parseSpread(p) : parseAssignment(p))
    if (!p.is(')')) p.expect(',')
  }
  p.noIn = noIn
  p.expect(')')
  return args
}

/**
 * Parses a spread element.
 *
 * @param p - The parser
 * @returns The node built
 *
 * @example Parse a spread element
 * ```ts
 * const node = parseSpread(new Parser('...items', '.ts'))
 * node.kind // => 'SpreadElement'
 * node.argument.name // => 'items'
 * ```
 */
export function parseSpread(p: Parser): Node {
  const start = p.next().start
  const argument = parseAssignment(p)
  return p.node('SpreadElement', start, { argument })
}
