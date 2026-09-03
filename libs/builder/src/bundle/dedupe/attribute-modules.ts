import type { ChunkFormat } from '../dependencies/prune/used-exports'
import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readDirectory, readFileContent } from '@hyperfrontend/project-scope/core'
import { getRequireSpecifier, parseChunk } from '../dependencies/prune/ast-utils'
import { collectReachableSources } from './source-reachability'

/**
 * A first-party module's path under `src/`, without extension and
 * forward-slashed (e.g. `events/events`, `models`). Doubles as the directory
 * name the module's hoisted chunk lives under: `_shared/<moduleKey>/`.
 */
export type ModuleKey = string

/**
 * Ownership index mapping each unambiguously-owned runtime symbol to the
 * first-party module that declares it.
 */
export interface OwnerIndex {
  /**
   * Maps a runtime symbol's base name (rollup `$N` collision suffix stripped)
   * to its owning module key. Names declared by more than one module are
   * omitted: an ambiguous name can never be safely attributed.
   */
  ownerOf: Map<string, ModuleKey>
}

/**
 * A single import binding observed at an entry bundle's top level, retaining
 * enough shape to re-materialize the same edge from a hoisted chunk.
 */
export interface ImportBinding {
  /** Raw module specifier exactly as written in the entry source. */
  specifier: string
  /** Shape of the binding, governing how it is re-emitted into a shared chunk. */
  kind: 'named' | 'namespace' | 'default' | 'cjs-namespace' | 'cjs-named'
  /** Exported name on the target module for `named`/`cjs-named` bindings. */
  imported?: string
}

/**
 * A removable top-level runtime declaration in an entry bundle, attributed to
 * its owning first-party module by name.
 */
export interface EntryDecl {
  /** Owning symbol's base name (collision suffix stripped). */
  base: string
  /** Local name exactly as the bundle declares it (may carry a `$N` suffix). */
  localName: string
  /** The owning top-level statement. */
  statement: ts.Statement
  /** Emitted code text (leading comments excluded); the raw chunk-body source. */
  text: string
  /**
   * Rename-insensitive identity key: `$N` suffixes stripped from identifier
   * nodes; the raw {@link text} is still the chunk-body source.
   */
  fingerprint: string
}

/**
 * Structural model of one parsed entry bundle.
 */
export interface ParsedEntry {
  /** The parsed source file. */
  sourceFile: ts.SourceFile
  /** Top-level runtime declarations in source order. */
  decls: EntryDecl[]
  /** Import/`require` bindings keyed by their local name. */
  importBindings: Map<string, ImportBinding>
  /** Top-level statements that are neither imports, declarations, nor the export surface. */
  bareStatements: ts.Statement[]
  /** Every local name a top-level declaration binds. */
  declNames: Set<string>
  /** End offset of the bundle's leading import/`require`/`'use strict'` header: the insertion point for hoisted imports. */
  headerEnd: number
}

/** Per-format output chunk file name, mirroring the bundler's entry naming. */
const CHUNK_FILE: Readonly<Record<ChunkFormat, string>> = { esm: 'index.esm.js', cjs: 'index.cjs.js' }

/**
 * Strips rollup's `$N` collision-rename suffix from a local name, yielding the
 * canonical source symbol name.
 *
 * @param name - A local identifier from an emitted bundle.
 * @returns The base name with any trailing `$digits` removed.
 *
 * @example Undoing a collision rename
 * ```typescript
 * baseName('Store$1') // => 'Store'
 * ```
 */
export const baseName = (name: string): string => name.replace(/\$\d+$/, '')

/**
 * Computes a rename-insensitive identity key for a top-level statement.
 *
 * Two copies of the same source that differ only in rollup's per-entry `$N`
 * collision suffixes compare equal, while genuinely different code never
 * collides: `$N` is stripped from identifier nodes only, so string literals,
 * comments, numeric tokens, and discriminating member names stay intact.
 *
 * @param statement - The top-level statement to fingerprint.
 * @param sourceFile - The source file the statement belongs to.
 * @returns The statement's text with `$N` stripped from every identifier node.
 *
 * @example Stripping a dep-namespace local's collision suffix
 * ```typescript
 * fingerprintOf(statement, sourceFile) // 'const x = index_cjs_js.getType();' for both `$1` and `$2` copies
 * ```
 */
export const fingerprintOf = (statement: ts.Statement, sourceFile: ts.SourceFile): string => {
  const start = statement.getStart(sourceFile)
  const text = statement.getText(sourceFile)
  const edits: Array<[number, number, string]> = []
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const base = baseName(node.text)
      if (base !== node.text) edits.push([node.getStart(sourceFile) - start, node.getEnd() - start, base])
    }
    ts.forEachChild(node, visit)
  }
  visit(statement)
  let out = text
  for (const [s, e, replacement] of edits.sort((a, b) => b[0] - a[0])) out = `${out.slice(0, s)}${replacement}${out.slice(e)}`
  return out
}

/**
 * Resolves a hoisted module's chunk file name for a format.
 *
 * @param format - Output module format.
 * @returns The per-entry chunk file name (`index.esm.js` / `index.cjs.js`).
 *
 * @example Naming the CJS chunk
 * ```typescript
 * chunkFileName('cjs') // => 'index.cjs.js'
 * ```
 */
export const chunkFileName = (format: ChunkFormat): string => CHUNK_FILE[format]

/**
 * Computes the `_shared/` directory (relative to the output root) that holds a
 * module's hoisted chunk.
 *
 * @param moduleKey - The owning module's key.
 * @returns The forward-slashed `_shared/<moduleKey>` directory.
 *
 * @example Locating a module's shared directory
 * ```typescript
 * sharedDirFor('events/events') // => '_shared/events/events'
 * ```
 */
export const sharedDirFor = (moduleKey: ModuleKey): string => `_shared/${moduleKey}`

const isExported = (statement: ts.Statement): boolean =>
  ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)

const declaredNames = (statement: ts.Statement): string[] => {
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name)
    return [statement.name.text]
  if (!ts.isVariableStatement(statement)) return []
  const names: string[] = []
  for (const decl of statement.declarationList.declarations) if (ts.isIdentifier(decl.name)) names.push(decl.name.text)
  return names
}

const requireSpecifierOf = (initializer: ts.Expression | undefined): string | null => {
  if (initializer === undefined) return null
  if (ts.isPropertyAccessExpression(initializer)) return getRequireSpecifier(initializer.expression)
  return getRequireSpecifier(initializer)
}

const isRequireVarStatement = (statement: ts.Statement): boolean =>
  ts.isVariableStatement(statement) &&
  statement.declarationList.declarations.length > 0 &&
  statement.declarationList.declarations.every((decl) => requireSpecifierOf(decl.initializer) !== null)

const collectCjsBindings = (statement: ts.VariableStatement, bindings: Map<string, ImportBinding>): void => {
  for (const decl of statement.declarationList.declarations) {
    const specifier = requireSpecifierOf(decl.initializer)
    if (specifier === null) continue
    if (ts.isIdentifier(decl.name)) {
      // why: `var x = require('s').foo` binds a single named export; the bare `var ns = require('s')` binds the whole namespace.
      const imported = decl.initializer && ts.isPropertyAccessExpression(decl.initializer) ? decl.initializer.name.text : undefined
      bindings.set(decl.name.text, imported ? { specifier, kind: 'cjs-named', imported } : { specifier, kind: 'cjs-namespace' })
    } else if (ts.isObjectBindingPattern(decl.name)) {
      for (const element of decl.name.elements)
        if (ts.isIdentifier(element.name))
          bindings.set(element.name.text, { specifier, kind: 'cjs-named', imported: (element.propertyName ?? element.name).getText() })
    }
  }
}

const collectEsmBindings = (statement: ts.ImportDeclaration, bindings: Map<string, ImportBinding>): void => {
  const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
  const clause = statement.importClause
  if (!clause) return
  if (clause.name) bindings.set(clause.name.text, { specifier, kind: 'default' })
  if (!clause.namedBindings) return
  if (ts.isNamespaceImport(clause.namedBindings)) {
    bindings.set(clause.namedBindings.name.text, { specifier, kind: 'namespace' })
    return
  }
  for (const element of clause.namedBindings.elements)
    bindings.set(element.name.text, { specifier, kind: 'named', imported: (element.propertyName ?? element.name).text })
}

const isUseStrict = (statement: ts.Statement): boolean =>
  ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === 'use strict'

const isHeaderStatement = (statement: ts.Statement, format: ChunkFormat): boolean =>
  isUseStrict(statement) || (format === 'esm' ? ts.isImportDeclaration(statement) : isRequireVarStatement(statement))

const isExportSurface = (statement: ts.Statement, format: ChunkFormat): boolean => {
  if (format === 'esm') return ts.isExportDeclaration(statement) && !statement.moduleSpecifier
  // why: CJS export surface is a chain of `exports.x = y` assignment statements emitted at the bundle tail.
  if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) return false
  const { left, operatorToken } = statement.expression
  return (
    operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(left) &&
    ts.isIdentifier(left.expression) &&
    left.expression.text === 'exports'
  )
}

/**
 * Parses one entry bundle into the structural model the hoist pass consumes.
 *
 * Classifies every top-level statement as an import binding, a removable
 * runtime declaration, the export surface, or an opaque bare statement. Inline
 * `export`-modified declarations are treated as part of the export surface
 * (never removable), so the bundle's published API is never disturbed.
 *
 * @param source - Raw entry bundle source text.
 * @param format - Module format selecting ESM vs CJS import/export shapes.
 * @returns The parsed entry model.
 *
 * @example Modeling an ESM entry bundle
 * ```typescript
 * const parsed = parseEntry("import { x } from './_dependencies/a/index.esm.js'\nclass C {}", 'esm')
 * ```
 */
export const parseEntry = (source: string, format: ChunkFormat): ParsedEntry => {
  const sourceFile = parseChunk(source)
  const decls: EntryDecl[] = []
  const importBindings = createMap<string, ImportBinding>()
  const bareStatements: ts.Statement[] = []
  const declNames = createSet<string>([])
  let headerEnd = 0
  let inHeader = true
  for (const statement of sourceFile.statements) {
    if (inHeader && isHeaderStatement(statement, format)) headerEnd = statement.getEnd()
    else inHeader = false
    if (format === 'esm' && ts.isImportDeclaration(statement)) {
      collectEsmBindings(statement, importBindings)
      continue
    }
    if (format === 'cjs' && isRequireVarStatement(statement)) {
      collectCjsBindings(statement as ts.VariableStatement, importBindings)
      continue
    }
    if (isUseStrict(statement) || isExportSurface(statement, format)) continue
    const names = isExported(statement) ? [] : declaredNames(statement)
    for (const name of names) declNames.add(name)
    // why: only a single-name, non-exported declaration can be cleanly lifted; multi-declarator and inline-exported statements stay put (and may entangle their module out of the plan).
    if (names.length !== 1) {
      bareStatements.push(statement)
      continue
    }
    decls.push({
      base: baseName(names[0] as string),
      localName: names[0] as string,
      statement,
      text: statement.getText(sourceFile),
      fingerprint: fingerprintOf(statement, sourceFile),
    })
  }
  return { sourceFile, decls, importBindings, bareStatements, declNames, headerEnd }
}

/**
 * Groups an entry's attributable declarations by their owning module.
 *
 * Declarations whose base name is unowned (a dependency or unexported helper
 * inlined into the bundle) are skipped, leaving them in place.
 *
 * @param parsed - A parsed entry bundle.
 * @param owners - The first-party ownership index.
 * @returns Map from module key to that module's declarations in source order.
 *
 * @example Attributing an entry's declarations
 * ```typescript
 * const byModule = attribute(parseEntry(source, 'esm'), owners)
 * ```
 */
export const attribute = (parsed: ParsedEntry, owners: OwnerIndex): Map<ModuleKey, EntryDecl[]> => {
  const byModule = createMap<ModuleKey, EntryDecl[]>()
  for (const decl of parsed.decls) {
    const moduleKey = owners.ownerOf.get(decl.base)
    if (moduleKey === undefined) continue
    const group = byModule.get(moduleKey) ?? []
    group.push(decl)
    byModule.set(moduleKey, group)
  }
  return byModule
}

const toModuleKey = (srcRoot: string, file: string): ModuleKey =>
  file
    .slice(srcRoot.length + 1)
    .replace(/\.ts$/, '')
    .split(/[\\/]/)
    .join('/')

// why: private top-level helpers (e.g. a reducer's `handlers` map) are inlined alongside the exported symbols that use them; attributing them too lets the whole module hoist instead of bailing on the "unresolved" private reference. Collisions across modules are dropped as ambiguous by indexOwners, preserving safety.
const ownersFromSource = (source: string): string[] => {
  const sourceFile = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const names: string[] = []
  for (const statement of sourceFile.statements) names.push(...declaredNames(statement))
  return names
}

const walkTsFiles = (dir: string, acc: string[]): void => {
  for (const entry of readDirectory(dir)) {
    if (entry.isDirectory) walkTsFiles(entry.path, acc)
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.spec.ts')) acc.push(entry.path)
  }
}

/**
 * Builds the first-party ownership index from the runtime symbols each module
 * declares.
 *
 * When `entryFiles` is given, only modules reachable from those entry sources
 * through the first-party import graph are indexed; a file the entries never
 * import — a spec-only fixture above all — can then never own a name, so a
 * bundle declaration merely named like one of its symbols (a tree-shaken JSON
 * key, say) stays unattributed instead of forming a phantom chunk. Without
 * `entryFiles` the whole `<srcRoot>/**` tree is scanned.
 *
 * Both exported and private top-level runtime declarations are indexed, so a
 * module's private helpers hoist alongside the exports that use them. Types-only
 * modules declare no runtime symbols and contribute nothing. A name declared by
 * two different modules is ambiguous and dropped from the index, so the pass can
 * never misattribute it.
 *
 * @param srcRoot - Absolute path to the project's `src/` directory.
 * @param entryFiles - Absolute entry point source files bounding the scan to
 * their import-reachable modules.
 * @returns The ownership index.
 *
 * @example Indexing only what a library's entries reach
 * ```typescript
 * const owners = indexOwners('/abs/libs/foo/src', ['/abs/libs/foo/src/index.ts'])
 * ```
 */
export const indexOwners = (srcRoot: string, entryFiles?: string[]): OwnerIndex => {
  const files: string[] = []
  if (entryFiles === undefined) walkTsFiles(srcRoot, files)
  else files.push(...collectReachableSources(entryFiles, srcRoot))
  const firstOwner = createMap<string, ModuleKey>()
  const ambiguous = createSet<string>([])
  const ownerOf = createMap<string, ModuleKey>()
  for (const file of files) {
    const moduleKey = toModuleKey(srcRoot, file)
    for (const name of ownersFromSource(readFileContent(file))) {
      if (ambiguous.has(name)) continue
      const prior = firstOwner.get(name)
      if (prior !== undefined && prior !== moduleKey) {
        ambiguous.add(name)
        ownerOf.delete(name)
        continue
      }
      firstOwner.set(name, moduleKey)
      ownerOf.set(name, moduleKey)
    }
  }
  return { ownerOf }
}
