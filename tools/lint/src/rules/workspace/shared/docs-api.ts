/**
 * What a package's sources say to its documentation: the symbols an entry exports, each with the
 * member names a reader may mention and the subset the reference anchors on their own lines, and
 * the declarations every source file makes, exported or not.
 *
 * @module rules/workspace/shared/docs-api
 */

import type { Node } from '@hyperfrontend/linter'
import type { DeclarationKind } from './exports-index.ts'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { moduleDeclarations, parsedModule, resolveModule } from './exports-index.ts'

/** What kind of thing a documented symbol is. */
export type DocsSymbolKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'unknown'

/** A symbol an entry exports. */
export interface DocsSymbol {
  /** The exported name. */
  readonly name: string
  /** What kind of thing it is. */
  readonly kind: DocsSymbolKind
  /** Every name a reader may mention as part of it: keys, members, enum and union values. */
  readonly members: readonly string[]
  /** The members the reference anchors as properties. */
  readonly properties: readonly string[]
  /** The members the reference anchors as methods. */
  readonly methods: readonly string[]
}

/** The symbol kind of each declaring node kind. */
const DECLARING: Readonly<Record<string, DocsSymbolKind>> = {
  FunctionDeclaration: 'function',
  TSDeclareFunction: 'function',
  ClassDeclaration: 'class',
  TSInterfaceDeclaration: 'interface',
  TSTypeAliasDeclaration: 'type',
  TSEnumDeclaration: 'enum',
}

/** The symbol kind of each kind of local declaration; a namespace has no members of its own to list. */
const KIND_OF: Readonly<Record<DeclarationKind, DocsSymbolKind>> = {
  function: 'function',
  class: 'class',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
  variable: 'variable',
  namespace: 'unknown',
  unknown: 'unknown',
}

/** The expression kinds that wrap a value without changing it. */
const WRAPPERS = createSet(['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'TSNonNullExpression'])

/** A symbol's three name lists while it is read. */
interface Shape {
  /** Every mentionable name. */
  readonly members: string[]
  /** The anchored properties. */
  readonly properties: string[]
  /** The anchored methods. */
  readonly methods: string[]
}

/**
 * Reads the name a key spells when it is written out: an identifier, or the value of a string or
 * number literal.
 *
 * @param key - The key node
 * @param computed - Whether the key is in brackets
 * @returns The name, or undefined for a computed or private key
 */
function keyName(key: Node | undefined, computed: unknown): string | undefined {
  if (computed === true || key === undefined) return undefined
  return key.kind === 'Identifier' ? (key.name as string) : String(key.value)
}

/**
 * Reads the value of a string literal.
 *
 * @param node - Any node
 * @returns The string, or undefined when the node is no string literal
 */
function stringOf(node: Node | null | undefined): string | undefined {
  return node?.kind === 'Literal' && typeof node.value === 'string' ? node.value : undefined
}

/**
 * Collects the names a type spells: the keys of its object literals and the values of its string
 * literals, through unions and intersections.
 *
 * @param type - A type node
 * @param shape - Where the names go
 */
function readType(type: Node, shape: Shape): void {
  if (type.kind === 'TSUnionType' || type.kind === 'TSIntersectionType') {
    for (const part of type.types as readonly Node[]) readType(part, shape)
  } else if (type.kind === 'TSTypeLiteral') {
    for (const member of type.members as readonly Node[]) {
      const name = keyName(member.key, member.computed)
      if (name !== undefined) shape.members.push(name)
    }
  } else if (type.kind === 'TSLiteralType') {
    const value = stringOf(type.literal)
    if (value !== undefined) shape.members.push(value)
  }
}

/**
 * Collects the members of an interface: property signatures are anchored, method signatures are
 * mentionable only.
 *
 * @param body - The interface's members
 * @param shape - Where the names go
 */
function readInterface(body: readonly Node[], shape: Shape): void {
  for (const member of body) {
    const name = keyName(member.key, member.computed)
    if (name === undefined) continue
    if (member.kind === 'TSPropertySignature') shape.properties.push(name)
    if (member.kind === 'TSPropertySignature' || member.kind === 'TSMethodSignature') shape.members.push(name)
  }
}

/**
 * Collects the public members of a class: a method, or an untyped property holding a function,
 * is anchored as a method; any other property as a property; an accessor is mentionable only.
 *
 * @param body - The class's elements
 * @param shape - Where the names go
 */
function readClass(body: readonly Node[], shape: Shape): void {
  for (const element of body) {
    if (element.accessibility === 'private' || element.methodKind === 'constructor') continue
    const name = keyName(element.key?.kind === 'PrivateIdentifier' ? undefined : element.key, element.computed)
    if (name === undefined) continue
    shape.members.push(name)
    const value = element.value as Node | null | undefined
    if (element.kind === 'MethodDefinition' || element.kind === 'TSAbstractMethodDefinition') {
      if (element.methodKind === 'method') shape.methods.push(name)
    } else if (
      element.typeAnnotation === undefined &&
      (value?.kind === 'ArrowFunctionExpression' || value?.kind === 'FunctionExpression')
    ) {
      shape.methods.push(name)
    } else shape.properties.push(name)
  }
}

/**
 * Collects the names an initialiser's object literal spells, through calls such as `freeze(...)`
 * and assertions such as `as const`: each written key, and each string value.
 *
 * @param init - The initialiser
 * @param shape - Where the names go
 */
function readValue(init: Node | null | undefined, shape: Shape): void {
  let value = init ?? undefined
  while (value !== undefined && (WRAPPERS.has(value.kind) || value.kind === 'CallExpression')) {
    value = value.kind === 'CallExpression' ? (value.arguments as readonly Node[])[0] : (value.expression as Node)
  }
  if (value?.kind !== 'ObjectExpression') return
  for (const property of value.properties as readonly Node[]) {
    if (property.kind !== 'Property') continue
    const name = keyName(property.key, property.computed)
    if (name !== undefined) shape.members.push(name)
    const text = stringOf(property.value as Node)
    if (text !== undefined) shape.members.push(text)
  }
}

/**
 * Describes a declaration as a documented symbol.
 *
 * @param name - The name it is exported under
 * @param kind - What kind of thing it is
 * @param node - The declaring node: the declaration, or the declarator of a variable
 * @returns The symbol
 */
function describe(name: string, kind: DocsSymbolKind, node: Node | null): DocsSymbol {
  const shape: Shape = { members: [], properties: [], methods: [] }
  const at = node as Node
  if (kind === 'interface') readInterface((at.body as Node).body as readonly Node[], shape)
  else if (kind === 'class') readClass((at.body as Node).body as readonly Node[], shape)
  else if (kind === 'type') readType(at.typeAnnotation as Node, shape)
  else if (kind === 'variable') readValue(at.init, shape)
  else if (kind === 'enum') {
    for (const member of (at.body as Node).members as readonly Node[]) {
      shape.members.push(keyName(member.id as Node, false) as string)
      const value = stringOf(member.init)
      if (value !== undefined) shape.members.push(value)
    }
  }
  return { name, kind, ...shape }
}

/**
 * Lists the declarations a statement exports in place: named declarations, and the simply named
 * declarators of a variable statement.
 *
 * @param declaration - The declaration an `export` carries
 * @returns Each exported name with its kind and declaring node
 */
function declared(declaration: Node): [string, DocsSymbolKind, Node][] {
  const kind = DECLARING[declaration.kind]
  if (kind !== undefined) return [[(declaration.id as Node).name as string, kind, declaration]]
  if (declaration.kind !== 'VariableDeclaration') return []
  return (declaration.declarations as readonly Node[])
    .filter((declarator) => (declarator.id as Node).kind === 'Identifier')
    .map((declarator) => [(declarator.id as Node).name as string, 'variable', declarator])
}

/**
 * Reads the name a module specifier's identifier or string carries.
 *
 * @param node - The identifier or string literal
 * @returns The identifier or string an import or export specifier names
 */
function specifierName(node: Node): string {
  return node.kind === 'Identifier' ? (node.name as string) : (node.value as string)
}

/**
 * Records a symbol unless the module already exports one by its name, as a value and the type of
 * the same name are documented together under the first.
 *
 * @param symbols - The module's symbols so far
 * @param symbol - A declaration that may already be listed
 */
function keep(symbols: Map<string, DocsSymbol>, symbol: DocsSymbol): void {
  if (!symbols.has(symbol.name)) symbols.set(symbol.name, symbol)
}

/**
 * Follows a module's exports: declarations exported in place, lists of local names, re-exports
 * from other modules and star re-exports. A namespace is no documented symbol, a local name
 * imported from elsewhere is known only by name, and a cycle is cut where it closes.
 *
 * @param file - The module
 * @param trail - The modules being followed, which a cycle would revisit
 * @returns The symbols by exported name
 */
function follow(file: string, trail: Set<string>): Map<string, DocsSymbol> {
  const symbols = createMap<string, DocsSymbol>()
  const program = parsedModule(file)
  if (program === null || trail.has(file)) return symbols
  trail.add(file)
  const locals = moduleDeclarations(file)
  for (const statement of program.body as readonly Node[]) {
    if (statement.kind === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration as Node
      const kind = DECLARING[declaration.kind]
      const id = declaration.id as Node | null | undefined
      if (kind !== undefined && id !== null && id !== undefined) keep(symbols, describe(id.name as string, kind, declaration))
    } else if (statement.kind === 'ExportAllDeclaration') {
      const target = resolveModule(file, (statement.source as Node).value as string)
      if (statement.exported !== null || target === null) continue
      for (const symbol of follow(target, trail).values()) keep(symbols, symbol)
    } else if (statement.kind === 'ExportNamedDeclaration') {
      const declaration = statement.declaration as Node | null
      if (declaration !== null) {
        for (const [name, kind, node] of declared(declaration)) keep(symbols, describe(name, kind, node))
        continue
      }
      const source = statement.source as Node | null
      const from = source === null ? null : resolveModule(file, source.value as string)
      const inner = from === null ? null : follow(from, trail)
      for (const specifier of statement.specifiers as readonly Node[]) {
        const local = specifierName(specifier.local as Node)
        const name = specifierName(specifier.exported as Node)
        const found = source === null ? locals.find((item) => item.name === local) : undefined
        const known = inner?.get(local) ?? (found === undefined ? undefined : describe(name, KIND_OF[found.kind], found.node))
        keep(symbols, known === undefined ? describe(name, 'unknown', null) : { ...known, name })
      }
    }
  }
  trail.delete(file)
  return symbols
}

/**
 * Reads the symbols an entry module exports.
 *
 * @param file - The entry's source file
 * @returns The symbols by name, empty for a file that is missing or does not parse
 */
export function readSymbols(file: string): Map<string, DocsSymbol> {
  return follow(file, createSet<string>())
}

/**
 * Lists the TypeScript sources under a directory: no tests, nothing under a hidden or a
 * double-underscore directory such as `__fixtures__`, and no other extensions.
 *
 * @param directory - The source directory, absolute
 * @returns The absolute paths, none for a missing directory
 */
export function listSources(directory: string): string[] {
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }
  const sources: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !entry.name.startsWith('__')) sources.push(...listSources(path))
    } else if (entry.name.endsWith('.ts') && !/\.(?:spec|test)\.ts$/.test(entry.name)) sources.push(path)
  }
  return sources
}

/**
 * Maps every name a source file declares at its top level to the files declaring it; variables
 * and namespaces are left out, as nothing documents them on their own.
 *
 * @param files - The source files
 * @returns The declaring files by name, in the order given
 */
export function readDeclarations(files: readonly string[]): Map<string, string[]> {
  const declarations = createMap<string, string[]>()
  for (const file of files) {
    for (const declaration of moduleDeclarations(file)) {
      if (declaration.kind === 'variable' || declaration.kind === 'namespace') continue
      const known = declarations.get(declaration.name) ?? []
      if (!known.includes(file)) known.push(file)
      declarations.set(declaration.name, known)
    }
  }
  return declarations
}
