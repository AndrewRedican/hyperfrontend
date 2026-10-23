/**
 * Statements and declarations: blocks, control flow, variables, functions, classes, decorators,
 * and the TypeScript declarations (interfaces, type aliases, enums, namespaces, ambient
 * declarations). Imports and exports live in their own module.
 *
 * @module code/parse-statements
 */

import type { Draft, Node } from './model'
import type { Parser } from './parser'
import { parseClass } from './parse-classes'
import { parseEnum, parseInterface, parseModuleDeclaration, parseTypeAlias } from './parse-declarations'
import { draft, parseAssignment, parseExpression } from './parse-expressions'
import { parseBindingElement, parseBindingTarget, parseFunctionTail, parseLeftHandSideForDecorator, toPattern } from './parse-functions'
import { parseExport, parseImport } from './parse-modules'
import { parseTypeAnnotation, parseTypeParameters } from './parse-types'
import { startsBinding } from './parser'

/**
 * Parses the decorators before a class or member.
 *
 * @param p - The parser
 * @returns The nodes built, none when there are none
 * @example Parse the decorators before a class keyword
 * ```ts
 * parseDecorators(new Parser('@Injectable() @Inject class Api {}', '.ts'))
 * // => two Decorator nodes, a CallExpression and an Identifier
 * ```
 */
export function parseDecorators(p: Parser): Node[] {
  const decorators: Node[] = []
  while (p.is('@')) {
    const start = p.next().start
    const expression = parseLeftHandSideForDecorator(p)
    decorators.push(p.node('Decorator', start, { expression }))
  }
  return decorators
}

/**
 * Parses a statement.
 *
 * @param p - The parser
 * @returns The node built
 * @example Parse a labelled loop
 * ```ts
 * const p = new Parser('outer: for (const id of ids) break outer', '.ts')
 * parseStatement(p).kind // => 'LabeledStatement'
 * ```
 */
export function parseStatement(p: Parser): Node {
  const token = p.token
  const start = token.start
  if (token.kind === 'punct') {
    if (token.value === '{') return parseBlock(p)
    if (token.value === ';') {
      p.next()
      return p.node('EmptyStatement', start)
    }
    if (token.value === '@') {
      const decorators = parseDecorators(p)
      if (p.isWord('export')) return parseExport(p, decorators)
      return parseClass(p, decorators, false)
    }
  }
  if (token.kind === 'name') {
    const declaration = parseDeclaration(p, false)
    if (declaration !== null) return declaration
    switch (token.value) {
      case 'if':
        return parseIf(p)
      case 'for':
        return parseFor(p)
      case 'while':
        return parseWhile(p)
      case 'do':
        return parseDoWhile(p)
      case 'switch':
        return parseSwitch(p)
      case 'try':
        return parseTry(p)
      case 'return':
        return parseReturn(p)
      case 'throw':
        return parseThrow(p)
      case 'break':
      case 'continue':
        return parseJump(p)
      case 'debugger':
        p.next()
        p.semicolon()
        return p.node('DebuggerStatement', start)
      case 'with':
        return parseWith(p)
      case 'import':
        if (!(p.peek().kind === 'punct' && (p.peek().value === '(' || p.peek().value === '.'))) return parseImport(p)
        break
      case 'export':
        return parseExport(p, [])
      default:
        break
    }
    if (p.isIdentifier(token) && p.peek().kind === 'punct' && p.peek().value === ':') return parseLabeled(p)
  }
  const expression = parseExpression(p)
  p.semicolon()
  return p.node('ExpressionStatement', start, { expression })
}

/**
 * Marks the directives of a program or function body: the string literal statements that open
 * it, up to the first statement of another shape.
 *
 * @param statements - The body's statements
 * @example A parenthesised string ends the directive prologue
 * ```ts
 * markDirectives(statements) // from "'use strict'; ('not')"
 * statements.map((node) => node.directive) // => ['use strict', undefined]
 * ```
 */
export function markDirectives(statements: readonly Node[]): void {
  for (const statement of statements) {
    const expression = statement.expression as Node | undefined
    if (statement.kind !== 'ExpressionStatement' || expression?.kind !== 'Literal' || typeof expression.value !== 'string') return
    // why: a parenthesised string is an expression, not a directive.
    if (expression.start !== statement.start) return
    ;(statement as Draft).directive = (expression.raw as string).slice(1, -1)
  }
}

/**
 * Parses a declaration when the current token opens one: a variable, function, class,
 * interface, type alias, enum, namespace or ambient declaration.
 *
 * @param p - The parser
 * @param declare - Whether `declare` came before
 * @returns The node built, or null when the token opens none
 * @example Return null when no declaration opens
 * ```ts
 * parseDeclaration(new Parser('total += 1', '.ts'), false) // => null
 * ```
 */
export function parseDeclaration(p: Parser, declare: boolean): Node | null {
  const token = p.token
  if (token.kind !== 'name') return null
  switch (token.value) {
    case 'var':
    case 'const':
      if (token.value === 'const' && p.isWordFollowedBy('const', (after) => after.kind === 'name' && after.value === 'enum'))
        return parseEnum(p, declare)
      return parseVariableStatement(p, declare)
    case 'let':
      return p.isWordFollowedBy('let', startsBinding) || startsBinding(p.peek()) ? parseVariableStatement(p, declare) : null
    case 'using':
      return p.isWordFollowedBy('using', (after) => after.kind === 'name' && after.value !== 'in' && after.value !== 'of')
        ? parseVariableStatement(p, declare)
        : null
    case 'await':
      return p.isWordFollowedBy('await', (after) => after.kind === 'name' && after.value === 'using') && startsUsingAfterAwait(p)
        ? parseVariableStatement(p, declare)
        : null

    case 'function':
      return parseFunctionDeclaration(p, false, declare)
    case 'async':
      return p.isWordFollowedBy('async', (after) => after.kind === 'name' && after.value === 'function')
        ? parseFunctionDeclaration(p, true, declare)
        : null
    case 'class':
      return parseClass(p, [], false, declare)
    case 'abstract':
      return p.isWordFollowedBy('abstract', (after) => after.kind === 'name' && after.value === 'class')
        ? parseClass(p, [], false, declare)
        : null
    case 'interface':
      return p.isWordFollowedBy('interface', (after) => after.kind === 'name') ? parseInterface(p, declare) : null
    case 'type':
      return p.isWordFollowedBy('type', (after) => after.kind === 'name') ? parseTypeAlias(p, declare) : null
    case 'enum':
      return p.isWordFollowedBy('enum', (after) => after.kind === 'name') ? parseEnum(p, declare) : null
    case 'namespace':
    case 'module':
      return p.isWordFollowedBy(token.value, (after) => after.kind === 'name' || after.kind === 'string')
        ? parseModuleDeclaration(p, declare)
        : null
    case 'global':
      return declare && p.peek().kind === 'punct' && p.peek().value === '{' ? parseModuleDeclaration(p, declare) : null
    case 'declare': {
      if (declare || !p.isWordFollowedBy('declare', (after) => after.kind === 'name')) return null
      const start = p.next().start
      const declaration = parseDeclaration(p, true)
      if (declaration === null) p.fail('Declaration expected.')
      draft(declaration).start = start
      return declaration
    }
    default:
      return null
  }
}

/**
 * Whether `await using` is followed by a binding name on the same line, which makes it a declaration.
 *
 * @param p - The parser
 * @returns True for a declaration
 */
function startsUsingAfterAwait(p: Parser): boolean {
  return (
    p.lookahead(() => {
      p.next()
      return p.isWordFollowedBy('using', (after) => after.kind === 'name' && after.value !== 'in' && after.value !== 'of')
    }) === true
  )
}

/**
 * Parses a block statement.
 *
 * @param p - The parser
 * @returns The node built
 * @example Parse a block of two statements
 * ```ts
 * parseBlock(new Parser('{ init(); run() }', '.ts')).body.length // => 2
 * ```
 */
export function parseBlock(p: Parser): Node {
  const start = p.token.start
  p.expect('{')
  const body: Node[] = []
  while (!p.is('}')) body.push(parseStatement(p))
  p.expect('}')
  return p.node('BlockStatement', start, { body })
}

/**
 * Parses a variable statement.
 *
 * @param p - The parser
 * @param declare - Whether it is ambient
 * @returns The node built
 */
function parseVariableStatement(p: Parser, declare: boolean): Node {
  const node = parseVariableDeclaration(p, declare)
  for (const declarator of node.declarations ?? []) {
    if (declarator.init === null && node.variableKind === 'const' && !declare && !p.ambient)
      p.fail("'const' declarations must be initialized.", declarator.start)
  }
  p.semicolon()
  node.end = p.lastEnd
  return node
}

/**
 * Parses a variable declaration without its semicolon, as a statement or a for head.
 *
 * @param p - The parser
 * @param declare - Whether it is ambient
 * @returns The node built
 * @example Parse an await using declaration
 * ```ts
 * const p = new Parser('await using handle = open()', '.ts')
 * parseVariableDeclaration(p, false).variableKind // => 'await using'
 * ```
 */
export function parseVariableDeclaration(p: Parser, declare: boolean): Node {
  const start = p.token.start
  let variableKind = p.next().value
  if (variableKind === 'await') {
    p.expectWord('using')
    variableKind = 'await using'
  }
  const declarations: Node[] = []
  do {
    const declaratorStart = p.token.start
    const id = parseBindingTarget(p)
    const definite = p.is('!') && !p.token.newlineBefore
    if (definite) {
      if (declare || (variableKind !== 'let' && variableKind !== 'var'))
        p.fail("A definite assignment assertion '!' is not permitted in this context.", id.start)
      p.next()
    }
    if (p.is(':')) {
      draft(id).typeAnnotation = parseTypeAnnotation(p)
      id.end = p.lastEnd
    }
    const init = p.eat('=') ? parseAssignment(p) : null
    if (definite && init !== null) p.fail('Declarations with initializers cannot also have definite assignment assertions.', id.start)
    if (definite && id.typeAnnotation === undefined)
      p.fail('Declarations with definite assignment assertions must also have type annotations.', id.start)
    if (declare && init !== null) p.fail('Initializers are not permitted in ambient contexts.', init.start)
    declarations.push(p.node('VariableDeclarator', declaratorStart, { id, init, definite }))
  } while (p.eat(','))
  return p.node('VariableDeclaration', start, { declarations, variableKind, declare })
}

/**
 * Parses a function declaration, from its `async` or `function` keyword.
 *
 * @param p - The parser
 * @param async - Whether the function is async
 * @param declare - Whether it is ambient
 * @returns The node built, an overload signature when there is no body
 * @example A function without a body is an overload signature
 * ```ts
 * const p = new Parser('function load(id: string): User', '.ts')
 * parseFunctionDeclaration(p, false, false).kind // => 'TSDeclareFunction'
 * ```
 */
export function parseFunctionDeclaration(p: Parser, async: boolean, declare: boolean): Node {
  const start = p.token.start
  if (async) p.next()
  p.expectWord('function')
  const generator = p.eat('*')
  const id = p.token.kind === 'name' ? p.identifier() : null
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  const outerBody = parseFunctionTail(p, start, async, generator, true, false)
  const body = outerBody.body as Node | undefined
  if (declare && body !== undefined) p.fail('An implementation cannot be declared in ambient contexts.', body.start)
  if (generator && (declare || body === undefined))
    p.fail(declare ? 'Generators are not allowed in an ambient context.' : 'A function signature cannot be declared as a generator.', start)
  if (outerBody.kind === 'TSEmptyBodyFunctionExpression') {
    return p.node('TSDeclareFunction', start, {
      id,
      params: outerBody.params,
      generator,
      async,
      typeParameters,
      returnType: outerBody.returnType,
      declare,
      expression: false,
    })
  }
  return p.node('FunctionDeclaration', start, {
    id,
    params: outerBody.params,
    body,
    generator,
    async,
    typeParameters,
    returnType: outerBody.returnType,
    declare,
    expression: false,
  })
}

/**
 * Parses an if statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseIf(p: Parser): Node {
  const start = p.next().start
  const test = parseParenthesised(p)
  const consequent = parseStatement(p)
  const alternate = p.eatWord('else') ? parseStatement(p) : null
  return p.node('IfStatement', start, { test, consequent, alternate })
}

/**
 * Parses an expression in parentheses.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseParenthesised(p: Parser): Node {
  p.expect('(')
  const expression = parseExpression(p)
  p.expect(')')
  return expression
}

/**
 * Parses a for, for-in, for-of or for-await statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseFor(p: Parser): Node {
  const start = p.next().start
  const isAwait = p.eatWord('await')
  p.expect('(')
  p.noIn = true
  const init = p.is(';') ? null : startsDeclarationInFor(p) ? parseVariableDeclaration(p, false) : parseExpression(p)
  p.noIn = false
  if (init !== null && (p.isWord('of') || p.isWord('in'))) {
    const kind = p.next().value === 'of' ? 'ForOfStatement' : 'ForInStatement'
    const loop = kind === 'ForOfStatement' ? 'for...of' : 'for...in'
    if (init.kind === 'VariableDeclaration') {
      const declarators = init.declarations as Node[]
      if (declarators.length !== 1) p.fail(`Only a single variable declaration is allowed in a '${loop}' statement.`, init.start)
      if (declarators[0].init !== null) p.fail(`The variable declaration of a '${loop}' statement cannot have an initializer.`, init.start)
      if (declarators[0].id?.typeAnnotation !== undefined)
        p.fail(`The variable declaration of a '${loop}' statement cannot have a type annotation.`, init.start)
    }
    const left = init.kind === 'VariableDeclaration' ? init : parseForTarget(p, init)
    const right = kind === 'ForOfStatement' ? parseAssignment(p) : parseExpression(p)
    p.expect(')')
    const body = parseStatement(p)
    return p.node(kind, start, kind === 'ForOfStatement' ? { left, right, body, await: isAwait } : { left, right, body })
  }
  p.expect(';')
  const test = p.is(';') ? null : parseExpression(p)
  p.expect(';')
  const update = p.is(')') ? null : parseExpression(p)
  p.expect(')')
  const body = parseStatement(p)
  return p.node('ForStatement', start, { init, test, update, body })
}

/**
 * Whether the head of a for statement opens a variable declaration.
 *
 * @param p - The parser
 * @returns True for `var`, `let`, `const` or `using` followed by a binding
 */
function startsDeclarationInFor(p: Parser): boolean {
  if (p.isWord('var') || p.isWord('const')) return true
  if (p.isWord('let')) return startsBinding(p.peek())
  if (p.isWord('using')) return p.peek().kind === 'name' && p.peek().value !== 'of' && p.peek().value !== 'in'
  if (p.isWord('await')) return p.peek().kind === 'name' && p.peek().value === 'using'
  return false
}

/**
 * Reinterprets the head expression of a for-in or for-of as its target.
 *
 * @param p - The parser
 * @param init - The expression
 * @returns The node built
 */
function parseForTarget(p: Parser, init: Node): Node {
  if (init.kind === 'Identifier' || init.kind === 'MemberExpression') return init
  if (init.kind === 'ArrayExpression' || init.kind === 'ObjectExpression') return toPattern(p, init)
  return p.fail('The left-hand side of a for statement must be a variable or a property access.', init.start)
}

/**
 * Parses a while statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseWhile(p: Parser): Node {
  const start = p.next().start
  const test = parseParenthesised(p)
  const body = parseStatement(p)
  return p.node('WhileStatement', start, { test, body })
}

/**
 * Parses a do-while statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseDoWhile(p: Parser): Node {
  const start = p.next().start
  const body = parseStatement(p)
  p.expectWord('while')
  const test = parseParenthesised(p)
  p.eat(';')
  return p.node('DoWhileStatement', start, { body, test })
}

/**
 * Parses a switch statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseSwitch(p: Parser): Node {
  const start = p.next().start
  const discriminant = parseParenthesised(p)
  p.expect('{')
  const cases: Node[] = []
  while (!p.is('}')) {
    const caseStart = p.token.start
    let test: Node | null = null
    if (p.eatWord('case')) test = parseExpression(p)
    else p.expectWord('default')
    p.expect(':')
    const consequent: Node[] = []
    while (!p.is('}') && !p.isWord('case') && !p.isWord('default')) consequent.push(parseStatement(p))
    cases.push(p.node('SwitchCase', caseStart, { test, consequent }))
  }
  p.expect('}')
  return p.node('SwitchStatement', start, { discriminant, cases })
}

/**
 * Parses a try statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseTry(p: Parser): Node {
  const start = p.next().start
  const block = parseBlock(p)
  let handler: Node | null = null
  if (p.isWord('catch')) {
    const catchStart = p.next().start
    let param: Node | null = null
    if (p.eat('(')) {
      param = parseBindingElement(p, false)
      p.expect(')')
    }
    const body = parseBlock(p)
    handler = p.node('CatchClause', catchStart, { param, body })
  }
  const finalizer = p.eatWord('finally') ? parseBlock(p) : null
  if (handler === null && finalizer === null) p.fail("'catch' or 'finally' expected.")
  return p.node('TryStatement', start, { block, handler, finalizer })
}

/**
 * Parses a return statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseReturn(p: Parser): Node {
  const start = p.next().start
  const argument = p.is(';') || p.is('}') || p.token.kind === 'eof' || p.token.newlineBefore ? null : parseExpression(p)
  p.semicolon()
  return p.node('ReturnStatement', start, { argument })
}

/**
 * Parses a throw statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseThrow(p: Parser): Node {
  const start = p.next().start
  if (p.token.newlineBefore) p.fail('Line break not permitted here.')
  const argument = parseExpression(p)
  p.semicolon()
  return p.node('ThrowStatement', start, { argument })
}

/**
 * Parses a break or continue statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseJump(p: Parser): Node {
  const token = p.next()
  const label = p.token.kind === 'name' && !p.token.newlineBefore && p.isIdentifier() ? p.identifier() : null
  p.semicolon()
  return p.node(token.value === 'break' ? 'BreakStatement' : 'ContinueStatement', token.start, { label })
}

/**
 * Parses a with statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseWith(p: Parser): Node {
  // why: a module is strict, and the compiler reports the statement before parsing its body.
  return p.fail("'with' statements are not allowed in strict mode.")
}

/**
 * Parses a labelled statement.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseLabeled(p: Parser): Node {
  const start = p.token.start
  const label = p.identifier()
  p.expect(':')
  const body = parseStatement(p)
  return p.node('LabeledStatement', start, { label, body })
}

/**
 * Parses a program.
 *
 * @param p - The parser
 * @returns The node built
 * @example The program starts at its first token, after leading comments
 * ```ts
 * parseProgram(new Parser('// lead\nrun()', '.ts')).start // => 8
 * ```
 */
export function parseProgram(p: Parser): Node {
  const body: Node[] = []
  while (p.token.kind !== 'eof') body.push(parseStatement(p))
  markDirectives(body)
  // why: the program spans from its first token to the end of the text, leading comments left out, as the old parser placed it.
  const program = p.node('Program', p.tokens[0]?.start ?? p.text.length, { body, sourceType: 'module' })
  program.end = p.text.length
  return program
}
