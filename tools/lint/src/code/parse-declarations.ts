/**
 * The TypeScript declarations: interfaces, type aliases, enums, and namespace, module and global
 * declarations.
 *
 * @module code/parse-declarations
 */

import type { Node } from './model.ts'
import type { Parser } from './parser.ts'
import { parseStringLiteral } from './literals.ts'
import { parseHeritage } from './parse-classes.ts'
import { parseAssignment } from './parse-expressions.ts'
import { parsePropertyKey } from './parse-functions.ts'
import { markDirectives, parseStatement } from './parse-statements.ts'
import { parseTypeMembers } from './parse-type-members.ts'
import { parseType, parseTypeParameters } from './parse-types.ts'

/**
 * Parses an interface declaration.
 *
 * @param p - The parser
 * @param declare - Whether it is ambient
 * @returns The node built
 */
export function parseInterface(p: Parser, declare: boolean): Node {
  const start = p.next().start
  const id = p.identifier()
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  const heritage: Node[] = []
  if (p.eatWord('extends')) {
    do heritage.push(parseHeritage(p, 'TSInterfaceHeritage'))
    while (p.eat(','))
  }
  const bodyStart = p.token.start
  const members = parseTypeMembers(p)
  const body = p.node('TSInterfaceBody', bodyStart, { body: members })
  return p.node('TSInterfaceDeclaration', start, { id, typeParameters, extends: heritage, body, declare })
}

/**
 * Parses a type alias.
 *
 * @param p - The parser
 * @param declare - Whether it is ambient
 * @returns The node built
 */
export function parseTypeAlias(p: Parser, declare: boolean): Node {
  const start = p.next().start
  const id = p.identifier()
  const typeParameters = p.is('<') ? parseTypeParameters(p) : undefined
  p.expect('=')
  const typeAnnotation = parseType(p)
  p.semicolon()
  return p.node('TSTypeAliasDeclaration', start, { id, typeParameters, typeAnnotation, declare })
}

/**
 * Parses an enum declaration, from `const` or `enum`.
 *
 * @param p - The parser
 * @param declare - Whether it is ambient
 * @returns The node built
 */
export function parseEnum(p: Parser, declare: boolean): Node {
  const start = p.token.start
  const isConst = p.eatWord('const')
  p.expectWord('enum')
  const id = p.identifier()
  const bodyStart = p.token.start
  p.expect('{')
  const members: Node[] = []
  while (!p.is('}')) {
    const memberStart = p.token.start
    const { key, computed } = parsePropertyKey(p)
    if (computed) p.fail('Computed property names are not allowed in enums.', key.start)
    if (key.kind === 'Literal' && typeof key.value === 'number') p.fail('An enum member cannot have a numeric name.', key.start)
    const init = p.eat('=') ? parseAssignment(p) : null
    members.push(p.node('TSEnumMember', memberStart, { id: key, init, computed }))
    if (!p.is('}')) p.expect(',')
  }
  p.expect('}')
  const body = p.node('TSEnumBody', bodyStart, { members })
  return p.node('TSEnumDeclaration', start, { id, body, const: isConst, declare })
}

/**
 * Parses a namespace, module or global declaration.
 *
 * @param p - The parser
 * @param declare - Whether it is ambient
 * @returns The node built
 */
export function parseModuleDeclaration(p: Parser, declare: boolean): Node {
  const start = p.token.start
  const keyword = p.next().value
  let id: Node
  if (keyword === 'global') id = p.node('Identifier', start, { name: 'global' })
  else if (p.token.kind === 'string') id = parseStringLiteral(p)
  else {
    const nameStart = p.token.start
    id = p.identifier()
    while (p.is('.')) {
      p.next()
      const right = p.identifier()
      id = p.node('TSQualifiedName', nameStart, { left: id, right })
    }
  }
  let body: Node | undefined
  if (p.is('{')) {
    const bodyStart = p.token.start
    p.next()
    const statements: Node[] = []
    const outerAmbient = p.ambient
    p.ambient = outerAmbient || declare
    while (!p.is('}')) statements.push(parseStatement(p))
    p.ambient = outerAmbient
    p.expect('}')
    markDirectives(statements)
    body = p.node('TSModuleBlock', bodyStart, { body: statements })
  } else p.semicolon()
  return p.node('TSModuleDeclaration', start, {
    id,
    body,
    moduleKind: keyword === 'global' ? 'global' : keyword,
    global: keyword === 'global',
    declare,
  })
}
