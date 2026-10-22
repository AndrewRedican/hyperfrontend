/**
 * Imports and exports in every form: default, named and namespace imports, type-only imports,
 * import equals, side-effect imports, import attributes; named, default, re-exported and
 * star exports, export assignments and namespace exports.
 *
 * @module code/parse-modules
 */

import type { Node } from './model.ts'
import type { Parser } from './parser.ts'
import { parseStringLiteral } from './literals.ts'
import { parseClass } from './parse-classes.ts'
import { parseAssignment } from './parse-expressions.ts'
import { parseDeclaration, parseFunctionDeclaration } from './parse-statements.ts'

/** The declarations an export of is type-only. */
const TYPE_DECLARATIONS = ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration']

/**
 * Parses an import declaration, from its keyword.
 *
 * @param p - The parser
 * @returns The node built
 */
export function parseImport(p: Parser): Node {
  const start = p.next().start
  if (p.token.kind === 'string') {
    const source = parseStringLiteral(p)
    const attributes = parseAttributes(p)
    p.semicolon()
    return p.node('ImportDeclaration', start, { specifiers: [], source, importKind: 'value', attributes })
  }
  const typeOnly = p.isWord('type') && isTypeOnlyImport(p)
  if (typeOnly) p.next()
  const importKind = typeOnly ? 'type' : 'value'
  const specifiers: Node[] = []
  if (p.token.kind === 'name' && !p.is('{') && !p.is('*')) {
    const localStart = p.token.start
    const local = p.identifier()
    if (p.is('=')) return parseImportEquals(p, start, local, importKind)
    specifiers.push(p.node('ImportDefaultSpecifier', localStart, { local }))
    if (!p.eat(',')) return finishImport(p, start, specifiers, importKind)
    if (typeOnly) p.fail('A type-only import can specify a default import or named bindings, but not both.', start)
  }
  if (p.is('*')) {
    const namespaceStart = p.next().start
    p.expectWord('as')
    const local = p.identifier()
    specifiers.push(p.node('ImportNamespaceSpecifier', namespaceStart, { local }))
  } else {
    p.expect('{')
    while (!p.is('}')) {
      specifiers.push(parseImportSpecifier(p))
      if (!p.is('}')) p.expect(',')
    }
    p.expect('}')
  }
  return finishImport(p, start, specifiers, importKind)
}

/**
 * Whether the `type` at the current token makes the import type-only rather than naming a
 * default binding called `type`.
 *
 * @param p - The parser
 * @returns True for a type-only import
 */
function isTypeOnlyImport(p: Parser): boolean {
  const after = p.peek()
  if (after.kind === 'punct') return after.value === '{' || after.value === '*'
  if (after.kind !== 'name') return false
  if (after.value !== 'from') return true
  return (
    p.lookahead(() => {
      p.next()
      p.next()
      return p.token.kind === 'name' && p.token.value === 'from'
    }) === true
  )
}

/**
 * Parses `import x = require('y')` or `import x = A.B`, after the identifier.
 *
 * @param p - The parser
 * @param start - The offset of the import keyword
 * @param id - The identifier
 * @param importKind - Whether the import is type-only
 * @returns The node built
 */
function parseImportEquals(p: Parser, start: number, id: Node, importKind: 'type' | 'value'): Node {
  p.expect('=')
  let moduleReference: Node
  if (p.isWord('require') && p.peek().kind === 'punct' && p.peek().value === '(') {
    const referenceStart = p.next().start
    p.expect('(')
    const expression = parseStringLiteral(p)
    p.expect(')')
    moduleReference = p.node('TSExternalModuleReference', referenceStart, { expression })
  } else moduleReference = parseEntityName(p)
  p.semicolon()
  return p.node('TSImportEqualsDeclaration', start, { id, moduleReference, importKind })
}

/**
 * Parses a dotted name as a qualified name.
 *
 * @param p - The parser
 * @returns The node built
 */
export function parseEntityName(p: Parser): Node {
  const start = p.token.start
  let name = p.identifier()
  while (p.is('.')) {
    p.next()
    const right = p.propertyName()
    name = p.node('TSQualifiedName', start, { left: name, right })
  }
  return name
}

/**
 * Parses one named import specifier.
 *
 * @param p - The parser
 * @returns The node built
 */
function parseImportSpecifier(p: Parser): Node {
  const start = p.token.start
  let importKind: 'type' | 'value' = 'value'
  if (p.isWord('type')) {
    const after = p.peek()
    const typeOnly = after.kind === 'string' || (after.kind === 'name' && (after.value !== 'as' || isDoubleAs(p)))
    if (typeOnly) {
      p.next()
      importKind = 'type'
    }
  }
  const imported = p.token.kind === 'string' ? parseStringLiteral(p) : p.propertyName()
  let local: Node
  if (p.eatWord('as')) local = p.identifier()
  else {
    if (imported.kind !== 'Identifier' || !p.isIdentifier({ ...p.token, kind: 'name', value: imported.name as string }))
      p.fail('Identifier expected.', imported.start)
    local = p.node('Identifier', imported.start, { name: imported.name })
  }
  return p.node('ImportSpecifier', start, { imported, local, importKind })
}

/**
 * Whether `type as as x` or `type as` names a type-only specifier rather than one called `type`.
 *
 * @param p - The parser
 * @returns True when the second word after `type` is also `as`, or nothing follows the first
 */
function isDoubleAs(p: Parser): boolean {
  return (
    p.lookahead(() => {
      p.next()
      p.next()
      return (p.token.kind === 'name' && p.token.value === 'as') || p.is(',') || p.is('}')
    }) === true
  )
}

/**
 * Parses the source and attributes of an import, after its specifiers.
 *
 * @param p - The parser
 * @param start - The offset of the import keyword
 * @param specifiers - The specifier nodes parsed so far
 * @param importKind - Whether the import is type-only
 * @returns The node built
 */
function finishImport(p: Parser, start: number, specifiers: Node[], importKind: 'type' | 'value'): Node {
  p.expectWord('from')
  const source = parseStringLiteral(p)
  const attributes = parseAttributes(p)
  p.semicolon()
  return p.node('ImportDeclaration', start, { specifiers, source, importKind, attributes })
}

/**
 * Parses import attributes, after `with` or `assert`.
 *
 * @param p - The parser
 * @returns The nodes built, none when there are none
 */
function parseAttributes(p: Parser): Node[] {
  if (!(p.isWord('with') || (p.isWord('assert') && !p.token.newlineBefore)) || p.peek().kind !== 'punct' || p.peek().value !== '{')
    return []
  p.next()
  p.expect('{')
  const attributes: Node[] = []
  while (!p.is('}')) {
    const start = p.token.start
    const key = p.token.kind === 'string' ? parseStringLiteral(p) : p.propertyName()
    p.expect(':')
    const value = parseStringLiteral(p)
    attributes.push(p.node('ImportAttribute', start, { key, value }))
    if (!p.is('}')) p.expect(',')
  }
  p.expect('}')
  return attributes
}

/**
 * Parses an export declaration, from its keyword.
 *
 * @param p - The parser
 * @param decorators - The decorators before it, for a decorated class
 * @returns The node built
 */
export function parseExport(p: Parser, decorators: Node[]): Node {
  // why: decorators before the keyword belong to the class, whose range starts at them; the export's range starts at its keyword.
  const start = p.token.start
  p.next()
  if (p.isWord('default')) return parseExportDefault(p, start, decorators)
  if (p.is('*') || (p.isWord('type') && p.peek().kind === 'punct' && p.peek().value === '*')) return parseExportAll(p, start)
  if (p.is('{') || (p.isWord('type') && p.peek().kind === 'punct' && p.peek().value === '{')) return parseExportNamed(p, start)
  if (p.is('=')) {
    p.next()
    const expression = parseAssignment(p)
    p.semicolon()
    return p.node('TSExportAssignment', start, { expression })
  }
  if (p.isWord('as')) {
    p.next()
    p.expectWord('namespace')
    const id = p.identifier()
    p.semicolon()
    return p.node('TSNamespaceExportDeclaration', start, { id })
  }
  if (p.isWord('import')) {
    const importStart = p.next().start
    const id = p.identifier()
    const declaration = parseImportEquals(p, importStart, id, 'value')
    return p.node('ExportNamedDeclaration', start, { declaration, specifiers: [], source: null, exportKind: 'value', attributes: [] })
  }
  const declaration = decorators.length > 0 ? parseClass(p, decorators, false, false, true) : parseDeclaration(p, false)
  if (declaration === null) p.fail('Declaration or statement expected.')
  const exportKind = TYPE_DECLARATIONS.includes(declaration.kind) || declaration.declare === true ? 'type' : 'value'
  return p.node('ExportNamedDeclaration', start, { declaration, specifiers: [], source: null, exportKind, attributes: [] })
}

/**
 * Parses `export default …`.
 *
 * @param p - The parser
 * @param start - The offset the export starts at
 * @param decorators - The decorators before it
 * @returns The node built
 */
function parseExportDefault(p: Parser, start: number, decorators: Node[]): Node {
  p.next()
  let declaration: Node
  if (p.isWord('function') || p.isWordFollowedBy('async', (after) => after.kind === 'name' && after.value === 'function')) {
    declaration = parseFunctionDeclaration(p, p.isWord('async'), false)
  } else if (
    p.isWord('class') ||
    p.is('@') ||
    p.isWordFollowedBy('abstract', (after) => after.kind === 'name' && after.value === 'class')
  ) {
    // why: a default-exported class may be anonymous, which only class expressions otherwise allow; it is still a declaration.
    declaration = { ...parseClass(p, decorators, true, false, decorators.length > 0), kind: 'ClassDeclaration' } as Node
  } else if (p.isWordFollowedBy('interface', (after) => after.kind === 'name')) {
    declaration = parseDeclaration(p, false) as Node
  } else {
    declaration = parseAssignment(p)
    p.semicolon()
  }
  return p.node('ExportDefaultDeclaration', start, { declaration, exportKind: 'value' })
}

/**
 * Parses `export * from …` and `export * as name from …`.
 *
 * @param p - The parser
 * @param start - The offset the export starts at
 * @returns The node built
 */
function parseExportAll(p: Parser, start: number): Node {
  const exportKind = p.eatWord('type') ? 'type' : 'value'
  p.expect('*')
  let exported: Node | null = null
  if (p.eatWord('as')) exported = p.token.kind === 'string' ? parseStringLiteral(p) : p.propertyName()
  p.expectWord('from')
  const source = parseStringLiteral(p)
  const attributes = parseAttributes(p)
  p.semicolon()
  return p.node('ExportAllDeclaration', start, { exported, source, exportKind, attributes })
}

/**
 * Parses `export { … }` with or without a source.
 *
 * @param p - The parser
 * @param start - The offset the export starts at
 * @returns The node built
 */
function parseExportNamed(p: Parser, start: number): Node {
  const exportKind = p.eatWord('type') ? 'type' : 'value'
  p.expect('{')
  const specifiers: Node[] = []
  while (!p.is('}')) {
    const specifierStart = p.token.start
    let specifierKind: 'type' | 'value' = 'value'
    if (p.isWord('type') && p.peek().kind !== 'punct' && !(p.peek().kind === 'name' && p.peek().value === 'as' && !isDoubleAs(p))) {
      p.next()
      specifierKind = 'type'
    }
    const local = p.token.kind === 'string' ? parseStringLiteral(p) : p.propertyName()
    const exported = p.eatWord('as')
      ? p.token.kind === 'string'
        ? parseStringLiteral(p)
        : p.propertyName()
      : p.node('Identifier', local.start, { name: local.name })
    specifiers.push(p.node('ExportSpecifier', specifierStart, { local, exported, exportKind: specifierKind }))
    if (!p.is('}')) p.expect(',')
  }
  p.expect('}')
  let source: Node | null = null
  let attributes: Node[] = []
  if (p.eatWord('from')) {
    source = parseStringLiteral(p)
    attributes = parseAttributes(p)
  }
  const quoted = specifiers.find((specifier) => specifier.local?.kind === 'Literal')
  if (source === null && quoted !== undefined)
    p.fail('A string literal cannot be used as a local exported binding without `from`.', quoted.start)
  p.semicolon()
  return p.node('ExportNamedDeclaration', start, { declaration: null, specifiers, source, exportKind, attributes })
}
