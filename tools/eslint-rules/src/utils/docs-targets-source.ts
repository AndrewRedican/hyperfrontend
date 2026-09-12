/**
 * What a package's TypeScript sources say about themselves: the names an
 * entry point exports, the members and properties each declaration carries,
 * and every function, class, interface, type and enum declared anywhere in
 * the package.
 *
 * Read with the TypeScript parser alone, never the checker: a parse is cheap
 * enough to repeat for every package on every lint run, and the questions
 * asked here (what is exported, what is declared, what members a declaration
 * lists) are all answered by syntax.
 *
 * @module utils/docs-targets-source
 */

import { dirname, join } from 'node:path'
import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, isDirectory, readDirectory, readFileIfExists } from './fs'

/** One exported symbol of an entry point, with the names a reader might mention when talking about it. */
export interface DocsSymbol {
  /** The exported name, which is also its anchor on the entry's page. */
  name: string
  /** What kind of declaration the symbol is; `unknown` when it could not be found. */
  kind: 'interface' | 'class' | 'type' | 'enum' | 'function' | 'variable' | 'unknown'
  /** Property, method, enum-member and literal-union names the declaration carries. */
  members: readonly string[]
  /** The subset of members that are properties of an interface or class, which the site anchors individually. */
  properties: readonly string[]
}

/** One entry point of a package: a subpath the manifest exports and the page the site gives it. */

/** Directories a package's source walk never enters. */
const SKIPPED_DIRECTORIES = ['node_modules', 'dist', '__fixtures__', '__test-utils__', 'integration-tests'] as const

/** Source file suffixes that hold tests rather than the package. */
const TEST_SUFFIXES = ['.spec.ts', '.test.ts', '.d.ts'] as const

/** Re-export hops followed before a declaration is given up on. */
const MAX_REEXPORT_DEPTH = 6

/** The shape of a manifest's `exports` field this index reads. */

/** A parsed source file and the declarations it exports, cached by path for the life of an index build. */
export type SourceCache = Map<string, ts.SourceFile | null>

/** A declaring statement, with the name it was found under after any re-export renames. */
interface FoundDeclaration {
  /** The statement that declares the name. */
  statement: ts.Statement
  /** The declared name, which differs from the exported one when a re-export renamed it. */
  name: string
}

/**
 * Maps a package root to the route its landing page is published at.
 *
 * Utility packages live under a shared umbrella and drop their `-utils`
 * suffix in the URL, which is the same mapping the site's own route table
 * performs.
 *
 * @param workspaceRoot - Absolute path of the workspace.
 * @param packageRoot - Absolute path of the package.
 * @returns The site-relative route, with a trailing slash.
 */

/**
 * Parses a source file once per index build.
 *
 * @param cache - The build's parse cache.
 * @param file - Absolute path of the file.
 * @returns The parsed file, or null when it cannot be read.
 */
export function parseSource(cache: SourceCache, file: string): ts.SourceFile | null {
  const cached = cache.get(file)
  if (cached !== undefined) {
    return cached
  }
  const text = readFileIfExists(file)
  const parsed = text === null ? null : ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false)
  cache.set(file, parsed)
  return parsed
}

/**
 * Resolves a relative module specifier to the source file it names.
 *
 * @param from - Absolute path of the importing file.
 * @param specifier - The module specifier as written.
 * @returns The absolute path, or null when the specifier is not relative or resolves to nothing.
 */
function resolveModule(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) {
    return null
  }
  const base = join(dirname(from), specifier.replace(/\.js$/, ''))
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (exists(candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Reads the name a declaration statement binds, when it binds exactly one.
 *
 * @param statement - A top-level statement.
 * @returns The declared names, empty for statements that declare nothing.
 */
function declaredNames(statement: ts.Statement): string[] {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : []
    )
  }
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name !== undefined
  ) {
    return [statement.name.text]
  }
  return []
}

/**
 * Reads the name a property-like member is declared under.
 *
 * @param name - The member's name node.
 * @returns The name, or null when it is computed.
 */
function memberName(name: ts.PropertyName | undefined): string | null {
  if (name === undefined) {
    return null
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return null
}

/**
 * Collects the member names a type node carries.
 *
 * A type literal contributes its properties and methods, a union of string
 * literals contributes the literal values (which is how event names and
 * protocol ids are spelled), and an intersection contributes whatever its
 * parts do. A reference to another type contributes nothing: following it
 * would need the checker, and the referenced type has members of its own.
 *
 * @param type - The type node.
 * @returns The member names.
 */
function membersOfType(type: ts.TypeNode): string[] {
  if (ts.isTypeLiteralNode(type)) {
    return type.members.flatMap((member) => {
      const name = memberName(member.name)
      return name === null ? [] : [name]
    })
  }
  if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
    return type.types.flatMap(membersOfType)
  }
  if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
    return [type.literal.text]
  }
  if (ts.isParenthesizedTypeNode(type)) {
    return membersOfType(type.type)
  }
  return []
}

/**
 * Collects the member names a declaration carries.
 *
 * @param statement - The declaring statement.
 * @param name - The name the members belong to, for a statement declaring several.
 * @returns The member names, empty for declarations without members.
 */
function membersOfDeclaration(statement: ts.Statement, name: string): string[] {
  if (ts.isInterfaceDeclaration(statement)) {
    return statement.members.flatMap((member) => {
      const declared = memberName(member.name)
      return declared === null ? [] : [declared]
    })
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    return membersOfType(statement.type)
  }
  if (ts.isClassDeclaration(statement)) {
    return statement.members.flatMap((member) => {
      const modifiers = ts.canHaveModifiers(member) ? (ts.getModifiers(member) ?? []) : []
      if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
        return []
      }
      const declared = memberName(member.name)
      return declared === null || declared.startsWith('#') ? [] : [declared]
    })
  }
  if (ts.isEnumDeclaration(statement)) {
    return statement.members.flatMap((member) => {
      const declared = memberName(member.name)
      const value = member.initializer !== undefined && ts.isStringLiteral(member.initializer) ? [member.initializer.text] : []
      return declared === null ? value : [declared, ...value]
    })
  }
  if (ts.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations.find(
      (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name
    )
    const literal = declaration?.initializer === undefined ? undefined : objectLiteralOf(declaration.initializer)
    if (literal !== undefined) {
      return literal.properties.flatMap((property) => {
        const declared = ts.isShorthandPropertyAssignment(property) ? property.name.text : memberName(property.name)
        // why: a frozen map of codes is read by its values as often as by its keys, and prose names the value
        const value =
          ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer) ? [property.initializer.text] : ([] as string[])
        return declared === null ? value : [declared, ...value]
      })
    }
  }
  return []
}

/**
 * Finds the object literal an initializer is built from, looking through an
 * `as const`, a `satisfies`, and a single-argument call such as `freeze(...)`.
 *
 * @param initializer - The variable's initializer.
 * @returns The object literal, or undefined when the initializer is something else.
 */
function objectLiteralOf(initializer: ts.Expression): ts.ObjectLiteralExpression | undefined {
  if (ts.isObjectLiteralExpression(initializer)) {
    return initializer
  }
  if (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer)) {
    return objectLiteralOf(initializer.expression)
  }
  if (ts.isCallExpression(initializer) && initializer.arguments.length === 1) {
    return objectLiteralOf(initializer.arguments[0] as ts.Expression)
  }
  return undefined
}

/**
 * Names the kind of a declaring statement.
 *
 * @param statement - The declaring statement.
 * @returns Which of the kinds the site distinguishes the statement is.
 */
function kindOfDeclaration(statement: ts.Statement): DocsSymbol['kind'] {
  if (ts.isInterfaceDeclaration(statement)) {
    return 'interface'
  }
  if (ts.isClassDeclaration(statement)) {
    return 'class'
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    return 'type'
  }
  if (ts.isEnumDeclaration(statement)) {
    return 'enum'
  }
  if (ts.isFunctionDeclaration(statement)) {
    return 'function'
  }
  return ts.isVariableStatement(statement) ? 'variable' : 'unknown'
}

/**
 * Collects the property names of an interface or class, the members the site
 * gives an anchor of their own.
 *
 * @param statement - The declaring statement.
 * @returns The property names, empty for any other declaration.
 */
function propertiesOfDeclaration(statement: ts.Statement): string[] {
  if (ts.isInterfaceDeclaration(statement)) {
    return statement.members.flatMap((member) => {
      const declared = ts.isPropertySignature(member) ? memberName(member.name) : null
      return declared === null ? [] : [declared]
    })
  }
  if (ts.isClassDeclaration(statement)) {
    return statement.members.flatMap((member) => {
      if (!ts.isPropertyDeclaration(member)) {
        return []
      }
      const modifiers = ts.getModifiers(member) ?? []
      if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
        return []
      }
      const declared = memberName(member.name)
      return declared === null || declared.startsWith('#') ? [] : [declared]
    })
  }
  return []
}

/**
 * Finds the statement that declares a name in a file, following re-exports
 * into the files they point at.
 *
 * @param cache - The build's parse cache.
 * @param file - Absolute path of the file to search.
 * @param name - The exported name to find.
 * @param depth - How many re-export hops have been followed already.
 * @returns The declaring statement, or null when it cannot be found within the hop budget.
 */
function findDeclaration(cache: SourceCache, file: string, name: string, depth = 0): FoundDeclaration | null {
  const source = parseSource(cache, file)
  if (source === null || depth > MAX_REEXPORT_DEPTH) {
    return null
  }
  for (const statement of source.statements) {
    if (declaredNames(statement).includes(name)) {
      return { statement, name }
    }
  }
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier === undefined || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue
    }
    const target = resolveModule(file, statement.moduleSpecifier.text)
    if (target === null) {
      continue
    }
    if (statement.exportClause === undefined) {
      const found = findDeclaration(cache, target, name, depth + 1)
      if (found !== null) {
        return found
      }
      continue
    }
    if (!ts.isNamedExports(statement.exportClause)) {
      continue
    }
    const element = statement.exportClause.elements.find((candidate) => candidate.name.text === name)
    if (element !== undefined) {
      return findDeclaration(cache, target, element.propertyName?.text ?? name, depth + 1)
    }
  }
  return null
}

/**
 * Reads every name an entry file exports.
 *
 * Named re-exports and local exported declarations are read directly; a
 * star re-export is followed into the module it names.
 *
 * @param cache - The build's parse cache.
 * @param file - Absolute path of the entry file.
 * @param depth - How many star re-exports have been followed already.
 * @returns The exported names, in declaration order.
 */
function exportedNames(cache: SourceCache, file: string, depth = 0): string[] {
  const source = parseSource(cache, file)
  if (source === null || depth > MAX_REEXPORT_DEPTH) {
    return []
  }
  const names: string[] = []
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
        names.push(...statement.exportClause.elements.map((element) => element.name.text))
      } else if (
        statement.exportClause === undefined &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const target = resolveModule(file, statement.moduleSpecifier.text)
        if (target !== null) {
          names.push(...exportedNames(cache, target, depth + 1))
        }
      }
      continue
    }
    const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : []
    if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      names.push(...declaredNames(statement))
    }
  }
  return names
}

/**
 * Builds the symbol table of one entry point.
 *
 * @param cache - The build's parse cache.
 * @param file - Absolute path of the entry file.
 * @returns The exported symbols with their members, by name.
 */
export function readSymbols(cache: SourceCache, file: string): Map<string, DocsSymbol> {
  const symbols = createMap<string, DocsSymbol>()
  for (const name of exportedNames(cache, file)) {
    if (symbols.has(name)) {
      continue
    }
    const declaration = findDeclaration(cache, file, name)
    const members = declaration === null ? [] : membersOfDeclaration(declaration.statement, declaration.name)
    const properties = declaration === null ? [] : propertiesOfDeclaration(declaration.statement)
    const kind = declaration === null ? 'unknown' : kindOfDeclaration(declaration.statement)
    symbols.set(name, { name, kind, members: [...createSet(members)], properties: [...createSet(properties)] })
  }
  return symbols
}

/**
 * Reads the bundle globals a project's build declares.
 *
 * @param projectJson - The parsed project manifest.
 * @returns Each global name mapped to the subpath its bundle exposes.
 */

/**
 * Lists every source file of a package that documents the package rather than tests it.
 *
 * @param dir - Directory to walk.
 * @param into - The list files are appended to.
 * @returns The list, for chaining.
 */
export function listSources(dir: string, into: string[] = []): string[] {
  for (const entry of readDirectory(dir)) {
    const path = join(dir, entry)
    if (isDirectory(path)) {
      if (!(SKIPPED_DIRECTORIES as readonly string[]).includes(entry) && !entry.startsWith('.')) {
        listSources(path, into)
      }
      continue
    }
    if (entry.endsWith('.ts') && !TEST_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
      into.push(path)
    }
  }
  return into
}

/**
 * Indexes every top-level function, class, interface, type and enum in a
 * package's sources.
 *
 * Variables are left out: a module-scope `feature` or `logger` shares its
 * name with the words prose uses for the thing itself, and a link to the file
 * declaring one would send the reader somewhere arbitrary.
 *
 * @param cache - The build's parse cache.
 * @param sources - Absolute paths of the package's source files.
 * @returns Each declared name mapped to the files declaring it.
 */
export function readDeclarations(cache: SourceCache, sources: readonly string[]): Map<string, readonly string[]> {
  const declarations = createMap<string, string[]>()
  for (const file of sources) {
    const source = parseSource(cache, file)
    for (const statement of source?.statements ?? []) {
      if (ts.isVariableStatement(statement)) {
        continue
      }
      for (const name of declaredNames(statement)) {
        const files = declarations.get(name) ?? []
        if (!files.includes(file)) {
          files.push(file)
        }
        declarations.set(name, files)
      }
    }
  }
  return declarations
}

/**
 * Fingerprints the inputs an index is built from, so a rebuild happens only
 * when a manifest, an entry or a source has changed.
 *
 * @param files - The files the index read.
 * @returns A string that changes when any of them does.
 */
