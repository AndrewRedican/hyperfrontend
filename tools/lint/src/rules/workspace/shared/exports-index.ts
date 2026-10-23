/**
 * What a source module declares and exports, read by parsing it once: the top-level
 * declarations with their nodes, and the exported names with the declaration behind each,
 * re-exports followed to the file that holds the declaration.
 *
 * @module rules/workspace/shared/exports-index
 */

import type { Node } from '@hyperfrontend/linter'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { parseCode } from '@hyperfrontend/linter/helpers'

/** What kind of thing a declaration is. */
export type DeclarationKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'namespace' | 'unknown'

/** A top-level declaration of a module. */
export interface Declaration {
  /** The declared name. */
  readonly name: string
  /** What kind of thing it declares. */
  readonly kind: DeclarationKind
  /** The declaring node, or null when the name is only known to exist. */
  readonly node: Node | null
  /** The absolute path of the file holding the declaration. */
  readonly file: string
  /** Whether the file exports it under that name. */
  readonly exported: boolean
}

/** A name a module exports, with the declaration behind it. */
export interface ModuleExport {
  /** The exported name. */
  readonly name: string
  /** What kind of thing it is. */
  readonly kind: DeclarationKind
  /** The declaring node, or null when the declaration was not found. */
  readonly node: Node | null
  /** The absolute path of the file holding the declaration, or the re-exporting file when unknown. */
  readonly file: string
}

/** What following a module's exports produced. */
interface Collected {
  /** The exports found. */
  readonly exports: readonly ModuleExport[]
  /** False when a re-export cycle cut the search short. */
  readonly complete: boolean
}

/** The declaration kinds by node kind. */
const KINDS: Readonly<Record<string, DeclarationKind>> = {
  FunctionDeclaration: 'function',
  TSDeclareFunction: 'function',
  ClassDeclaration: 'class',
  TSInterfaceDeclaration: 'interface',
  TSTypeAliasDeclaration: 'type',
  TSEnumDeclaration: 'enum',
  TSModuleDeclaration: 'namespace',
}

/** The source extensions a specifier without one may name, in resolution order. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']

/** The source extension each emitted extension is written from. */
const SOURCE_OF: Readonly<Record<string, string>> = { '.js': '.ts', '.mjs': '.mts', '.cjs': '.cts' }

const programs = createMap<string, Node | null>()
const declarationsByFile = createMap<string, readonly Declaration[]>()
const exportsByFile = createMap<string, readonly ModuleExport[]>()

/**
 * Whether a path names an existing file.
 *
 * @param path - The absolute path
 * @returns True for a file
 */
function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

/**
 * The program of a source file, parsed once.
 *
 * @param file - The absolute path
 * @returns The program, or null when the file is missing or does not parse
 */
export function parsedModule(file: string): Node | null {
  const known = programs.get(file)
  if (known !== undefined) return known
  let program: Node | null = null
  if (isFile(file)) program = parseCode(readFileSync(file, 'utf8'), extname(file), 'module', file.endsWith('.d.ts')).tree
  programs.set(file, program)
  return program
}

/**
 * The file a relative specifier names from a module: the written path, the source file of an
 * emitted extension, then the extensions and the index files tried in order.
 *
 * @param from - The absolute path of the importing module
 * @param specifier - The specifier as written
 * @returns The absolute path of the file, or null for a bare specifier or a missing file
 */
export function resolveModule(from: string, specifier: string): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../') && !isAbsolute(specifier)) return null
  const base = resolve(dirname(from), specifier)
  const extension = extname(base)
  const candidates = [base]
  if (extension in SOURCE_OF) candidates.unshift(base.slice(0, -extension.length) + SOURCE_OF[extension])
  for (const suffix of EXTENSIONS) candidates.push(base + suffix)
  for (const suffix of EXTENSIONS) candidates.push(join(base, `index${suffix}`))
  return candidates.find(isFile) ?? null
}

/**
 * The identifiers a binding pattern declares.
 *
 * @param pattern - An identifier, object pattern, array pattern, assignment pattern or rest element
 * @param found - Where the identifier nodes go
 */
function bindingNames(pattern: Node, found: Node[]): void {
  switch (pattern.kind) {
    case 'Identifier':
      found.push(pattern)
      break
    case 'ObjectPattern':
      for (const property of pattern.properties as readonly Node[])
        bindingNames(property.kind === 'Property' ? (property.value as Node) : property, found)
      break
    case 'ArrayPattern':
      for (const element of pattern.elements as readonly (Node | null)[]) if (element !== null) bindingNames(element, found)
      break
    case 'AssignmentPattern':
      bindingNames(pattern.left as Node, found)
      break
    default:
      bindingNames(pattern.argument as Node, found)
  }
}

/**
 * The declarations a statement makes, with the names they bind.
 *
 * @param statement - A top-level statement, the `export` around it removed
 * @param file - The file holding it
 * @param exported - Whether the statement is exported
 * @param found - Where the declarations go
 */
function declare(statement: Node, file: string, exported: boolean, found: Declaration[]): void {
  const kind = KINDS[statement.kind]
  if (kind !== undefined) {
    const id = statement.id as Node | null
    if (id !== null) found.push({ name: id.name as string, kind, node: statement, file, exported })
    return
  }
  if (statement.kind !== 'VariableDeclaration') return
  for (const declarator of statement.declarations as readonly Node[]) {
    const names: Node[] = []
    bindingNames(declarator.id as Node, names)
    for (const name of names) found.push({ name: name.name as string, kind: 'variable', node: declarator, file, exported })
  }
}

/**
 * The top-level declarations of a module, in source order; a name exported through a list is
 * marked exported.
 *
 * @param file - The absolute path
 * @returns The declarations, none when the file is missing or does not parse
 */
export function moduleDeclarations(file: string): readonly Declaration[] {
  const known = declarationsByFile.get(file)
  if (known !== undefined) return known
  const found: Declaration[] = []
  const program = parsedModule(file)
  const statements = program === null ? [] : (program.body as readonly Node[])
  for (const statement of statements) {
    if (statement.kind === 'ExportNamedDeclaration') {
      const declaration = statement.declaration as Node | null
      if (declaration !== null) declare(declaration, file, true, found)
    } else declare(statement, file, false, found)
  }
  const listed = createSet<string>()
  for (const statement of statements) {
    if (statement.kind !== 'ExportNamedDeclaration' || statement.source !== null) continue
    for (const specifier of statement.specifiers as readonly Node[]) listed.add((specifier.local as Node).name as string)
  }
  const declarations = found.map((declaration) => (listed.has(declaration.name) ? { ...declaration, exported: true } : declaration))
  declarationsByFile.set(file, declarations)
  return declarations
}

/**
 * The name a specifier's identifier or string carries.
 *
 * @param node - An identifier or a string literal
 * @returns The name the identifier or string literal carries
 */
function nameOf(node: Node): string {
  return node.kind === 'Identifier' ? (node.name as string) : (node.value as string)
}

/**
 * The export a module provides under a name, resolved through the chain of re-exports.
 *
 * @param file - The absolute path of the module, or null when it could not be resolved
 * @param name - The name looked for
 * @param visiting - The files on the current chain, which a cycle would revisit
 * @returns The export, or null
 */
function exportFrom(file: string | null, name: string, visiting: Set<string>): Collected {
  if (file === null) return { exports: [], complete: true }
  const collected = collect(file, visiting)
  return { exports: collected.exports.filter((item) => item.name === name), complete: collected.complete }
}

/**
 * The local bindings an import statement brings in, by local name.
 *
 * @param program - The module's program
 * @param file - The module's path, which relative sources resolve from
 * @returns The imported name and resolved file of each binding
 */
function importBindings(program: Node | null, file: string): Map<string, ImportBinding> {
  const bindings = createMap<string, ImportBinding>()
  for (const statement of program === null ? [] : (program.body as readonly Node[])) {
    if (statement.kind !== 'ImportDeclaration') continue
    const source = resolveModule(file, (statement.source as Node).value as string)
    for (const specifier of statement.specifiers as readonly Node[]) {
      if (specifier.kind !== 'ImportSpecifier') continue
      bindings.set((specifier.local as Node).name as string, { name: nameOf(specifier.imported as Node), source })
    }
  }
  return bindings
}

/** Where an imported binding comes from. */
interface ImportBinding {
  /** The name imported. */
  readonly name: string
  /** The file it is imported from, or null when unresolved. */
  readonly source: string | null
}

/**
 * Follows a module's exports.
 *
 * @param file - The absolute path
 * @param visiting - The files on the current chain, which a cycle would revisit
 * @returns The exports and whether the search was complete
 */
function collect(file: string, visiting: Set<string>): Collected {
  const known = exportsByFile.get(file)
  if (known !== undefined) return { exports: known, complete: true }
  if (visiting.has(file)) return { exports: [], complete: false }
  visiting.add(file)
  const program = parsedModule(file)
  const declarations = moduleDeclarations(file)
  const bindings = importBindings(program, file)
  const found: ModuleExport[] = declarations.filter((declaration) => declaration.exported)
  let complete = true
  for (const statement of program === null ? [] : (program.body as readonly Node[])) {
    if (statement.kind === 'ExportDefaultDeclaration') {
      found.push({ name: 'default', kind: 'unknown', node: statement.declaration as Node, file })
      continue
    }
    if (statement.kind === 'ExportAllDeclaration') {
      const target = resolveModule(file, (statement.source as Node).value as string)
      const exported = statement.exported as Node | null
      if (exported !== null) found.push({ name: nameOf(exported), kind: 'namespace', node: null, file })
      else if (target !== null) {
        const inner = collect(target, visiting)
        complete &&= inner.complete
        found.push(...inner.exports)
      }
      continue
    }
    if (statement.kind !== 'ExportNamedDeclaration' || statement.declaration !== null) continue
    const source = statement.source as Node | null
    for (const specifier of statement.specifiers as readonly Node[]) {
      const local = nameOf(specifier.local as Node)
      const name = nameOf(specifier.exported as Node)
      if (source !== null) {
        const inner = exportFrom(resolveModule(file, source.value as string), local, visiting)
        complete &&= inner.complete
        found.push(
          ...(inner.exports.length > 0
            ? inner.exports.map((item) => ({ ...item, name }))
            : [{ name, kind: 'unknown' as const, node: null, file }])
        )
        continue
      }
      const declaration = declarations.find((item) => item.name === local)
      if (declaration !== undefined) {
        // why: a declaration listed under its own name is already among the exported declarations; a renamed one is added under the new name.
        if (name !== local) found.push({ name, kind: declaration.kind, node: declaration.node, file })
        continue
      }
      const binding = bindings.get(local)
      const inner = binding === undefined ? { exports: [], complete: true } : exportFrom(binding.source, binding.name, visiting)
      complete &&= inner.complete
      found.push(
        ...(inner.exports.length > 0
          ? inner.exports.map((item) => ({ ...item, name }))
          : [{ name, kind: 'unknown' as const, node: null, file }])
      )
    }
  }
  visiting.delete(file)
  if (complete) exportsByFile.set(file, found)
  return { exports: found, complete }
}

/**
 * The names a module exports, with the declaration behind each; `export *` and `export { x }
 * from` are followed, a cycle is cut, and an exported name whose declaration is not found is
 * kept with an unknown kind.
 *
 * @param file - The absolute path
 * @returns The exports, in the order the module lists them
 */
export function moduleExports(file: string): readonly ModuleExport[] {
  return collect(file, createSet<string>()).exports
}
