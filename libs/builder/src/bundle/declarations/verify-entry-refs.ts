import type { BuildContext } from '../../models'
import ts from 'typescript'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, getDirname, join, readFileContent, relativePath } from '@hyperfrontend/project-scope/core'
import { entryDirOf } from '../fs/entry-dir'

const log = logger.channel('builder:bundle:declarations:verify-entry-refs')

const INDEX_DTS_NAME = 'index.d.ts'

// note: The name a default export is referenced by in an import clause and an `export { x as default }` element alike.
const DEFAULT_EXPORT_NAME = 'default'

/**
 * A reference from one entry's `index.d.ts` to a sibling entry that names
 * symbols the sibling does not export.
 */
export interface DanglingEntryRef {
  /** Absolute path of the `index.d.ts` holding the reference. */
  source: string
  /** Specifier exactly as written in the referencing declaration. */
  specifier: string
  /** Absolute path of the entry `index.d.ts` the specifier resolves to. */
  target: string
  /** Referenced names absent from the target entry's export list. */
  missing: string[]
}

/**
 * A named reference into another module found in a declaration file.
 */
export interface EntryRef {
  /** Specifier exactly as written in the declaration. */
  specifier: string
  /** Names the statement pulls from the target module, as the target must export them. */
  names: string[]
}

/**
 * One `export { source as exported } from 'specifier'` element of a declaration file.
 */
export interface ReExport {
  /** Specifier exactly as written in the declaration. */
  specifier: string
  /** The name the file exports. */
  exported: string
  /** The name the target module must export, `exported` itself when not renamed. */
  source: string
}

/**
 * One hop of an alias cycle: an entry `index.d.ts` re-exporting a name from a sibling entry.
 */
export interface AliasHop {
  /** Absolute path of the `index.d.ts` holding the re-export. */
  source: string
  /** The name the file exports. */
  exported: string
  /** Specifier exactly as written in the declaration. */
  specifier: string
}

/**
 * Parses a declaration file's text into a `ts.SourceFile`.
 *
 * Parent pointers are left unset: every statement this pass inspects is a
 * top-level import/export, reachable straight off `statements`.
 *
 * @param source - Raw `.d.ts` text.
 * @returns The parsed source file.
 */
const parseDeclarations = (source: string): ts.SourceFile =>
  ts.createSourceFile(INDEX_DTS_NAME, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)

/**
 * Returns the literal text of a module specifier expression, or `null` when the
 * specifier is not a plain string literal.
 *
 * @param specifier - The `moduleSpecifier` expression of an import/export.
 * @returns The specifier text, or `null`.
 */
const specifierText = (specifier: ts.Expression | undefined): string | null =>
  specifier !== undefined && ts.isStringLiteralLike(specifier) ? specifier.text : null

/**
 * Returns the names a top-level statement contributes to its module's export
 * list, or an empty array when the statement exports nothing.
 *
 * @param statement - A top-level declaration statement.
 * @returns The exported names.
 */
const declaredExportNames = (statement: ts.Statement): string[] => {
  const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : []
  if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return []
  if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) return [DEFAULT_EXPORT_NAME]
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : []
    )
  }
  const named = statement as ts.DeclarationStatement
  return named.name !== undefined && ts.isIdentifier(named.name) ? [named.name.text] : []
}

/**
 * Collects the names an entry's bundled `index.d.ts` exports.
 *
 * Returns `null` for an open export set: a bare `export * from '…'` re-exports
 * names this pass cannot enumerate, so no reference against that entry can be
 * called dangling.
 *
 * @param source - Raw text of the entry's `index.d.ts`.
 * @returns The exported names, or `null` when the set is open.
 *
 * @example Reading an entry's public type surface
 * ```typescript
 * collectExportedNames('export type { A } from "./a";\nexport declare const b: number;')
 * // => Set { 'A', 'b' }
 * ```
 */
export const collectExportedNames = (source: string): Set<string> | null => {
  const names = createSet<string>([])
  for (const statement of parseDeclarations(source).statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause
      if (clause === undefined) return null
      if (ts.isNamespaceExport(clause)) {
        names.add(clause.name.text)
        continue
      }
      for (const element of clause.elements) names.add(element.name.text)
      continue
    }
    if (ts.isExportAssignment(statement)) {
      names.add(DEFAULT_EXPORT_NAME)
      continue
    }
    for (const name of declaredExportNames(statement)) names.add(name)
  }
  return names
}

/**
 * Collects every named import/re-export a declaration file makes from another
 * module, keyed by the specifier as written.
 *
 * Namespace and star forms carry no names to falsify and are skipped; a default
 * import is recorded as the `default` name.
 *
 * @param source - Raw text of the declaration file.
 * @returns One record per named import/re-export statement.
 *
 * @example Reading the cross-entry references of a subpath entry
 * ```typescript
 * collectEntryRefs("import { A } from '..';")
 * // => [{ specifier: '..', names: ['A'] }]
 * ```
 */
export const collectEntryRefs = (source: string): EntryRef[] => {
  const refs: EntryRef[] = []
  for (const statement of parseDeclarations(source).statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = specifierText(statement.moduleSpecifier)
      const clause = statement.importClause
      if (specifier === null || clause === undefined) continue
      const names: string[] = clause.name === undefined ? [] : [DEFAULT_EXPORT_NAME]
      const bindings = clause.namedBindings
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) names.push((element.propertyName ?? element.name).text)
      }
      if (names.length > 0) refs.push({ specifier, names })
      continue
    }
    if (!ts.isExportDeclaration(statement)) continue
    const specifier = specifierText(statement.moduleSpecifier)
    const clause = statement.exportClause
    if (specifier === null || clause === undefined || ts.isNamespaceExport(clause)) continue
    refs.push({ specifier, names: clause.elements.map((element) => (element.propertyName ?? element.name).text) })
  }
  return refs
}

/**
 * Collects every named re-export a declaration file makes from another module, one record per
 * exported name, with the name the target must export when the element renames it.
 *
 * @param source - Raw text of the declaration file.
 * @returns One record per re-exported name.
 *
 * @example Reading the names an entry forwards from its siblings
 * ```typescript
 * collectReExports("export { A, B as C } from './b';")
 * // => [{ specifier: './b', exported: 'A', source: 'A' }, { specifier: './b', exported: 'C', source: 'B' }]
 * ```
 */
export const collectReExports = (source: string): ReExport[] => {
  const reExports: ReExport[] = []
  for (const statement of parseDeclarations(source).statements) {
    if (!ts.isExportDeclaration(statement)) continue
    const specifier = specifierText(statement.moduleSpecifier)
    const clause = statement.exportClause
    if (specifier === null || clause === undefined || ts.isNamespaceExport(clause)) continue
    for (const element of clause.elements) {
      reExports.push({ specifier, exported: element.name.text, source: (element.propertyName ?? element.name).text })
    }
  }
  return reExports
}

/**
 * Locates every entry `index.d.ts` the build emitted.
 *
 * @param context - Resolved build context.
 * @returns Absolute paths of the entries' declaration files, in entry order.
 */
const emittedEntryIndexes = (context: BuildContext): string[] => {
  const paths: string[] = []
  for (const entry of context.entryPointDiscovery.entryPoints) {
    const indexPath = join(entryDirOf(entry, context), INDEX_DTS_NAME)
    if (exists(indexPath)) paths.push(indexPath)
  }
  return paths
}

/**
 * Finds cross-entry declaration references that name symbols the target entry
 * does not export.
 *
 * The per-entry d.ts pass rewrites any type import that resolves inside another
 * entry's directory into a specifier targeting that entry (`'..'`, `'./feature'`),
 * on the assumption that the entry re-exports what its subtree declares. When it
 * does not, the emitted reference resolves to nothing: `skipLibCheck` (on in
 * every consumer scaffold) hides the broken declaration file, and the symbol
 * silently degrades to an error type in consumer code instead: an event
 * handler's parameter turning implicitly `any`, a re-exported payload type
 * becoming unusable. This pass reads the emitted entry declarations back and
 * reports each such reference.
 *
 * @param context - Resolved build context.
 * @returns One record per dangling reference; empty when the type surface resolves.
 *
 * @example Auditing the emitted declarations after the per-entry pass
 * ```typescript
 * const dangling = findDanglingEntryRefs(context)
 * ```
 */
export const findDanglingEntryRefs = (context: BuildContext): DanglingEntryRef[] => {
  const indexPaths = emittedEntryIndexes(context)
  const entryIndexes = createSet(indexPaths)
  const exportsByPath = createMap<string, Set<string> | null>()
  const exportsOf = (path: string): Set<string> | null => {
    if (!exportsByPath.has(path)) exportsByPath.set(path, collectExportedNames(readFileContent(path)))
    return exportsByPath.get(path) ?? null
  }
  const dangling: DanglingEntryRef[] = []
  for (const source of indexPaths) {
    const dir = getDirname(source)
    for (const ref of collectEntryRefs(readFileContent(source))) {
      if (!ref.specifier.startsWith('.')) continue
      const target = join(dir, ref.specifier, INDEX_DTS_NAME)
      if (target === source || !entryIndexes.has(target)) continue
      const exported = exportsOf(target)
      if (exported === null) continue
      const missing = ref.names.filter((name) => !exported.has(name))
      if (missing.length > 0) dangling.push({ source, specifier: ref.specifier, target, missing })
    }
  }
  return dangling
}

/**
 * A cross-entry re-export as the cycle walk follows it, keyed by the exporting file and name.
 */
interface AliasEdge {
  /** The hop the edge records. */
  hop: AliasHop
  /** The key of the file and name the re-export resolves to. */
  next: string
}

/**
 * Finds names the emitted entry declarations re-export around a cycle of entries.
 *
 * The per-entry d.ts pass attributes a non-entry source to the entry whose directory holds it,
 * so an entry that forwards a name from a sibling while that sibling imports the same name back
 * from it emits two re-exports pointing at each other. TypeScript rejects the pair as
 * `TS2303 Circular definition of import alias` in any consumer that type-checks declarations,
 * and `skipLibCheck` consumers silently read the name as an error type instead. This pass
 * follows every cross-entry re-export from name to name and reports each cycle once, as the
 * hops that form it in re-export order.
 *
 * @param context - Resolved build context.
 * @returns One hop list per cycle; empty when no name aliases itself.
 *
 * @example Auditing the emitted declarations after the per-entry pass
 * ```typescript
 * const cycles = findAliasCycles(context)
 * ```
 */
export const findAliasCycles = (context: BuildContext): AliasHop[][] => {
  const indexPaths = emittedEntryIndexes(context)
  const entryIndexes = createSet(indexPaths)
  const edges = createMap<string, AliasEdge>()
  for (const source of indexPaths) {
    const dir = getDirname(source)
    for (const reExport of collectReExports(readFileContent(source))) {
      if (!reExport.specifier.startsWith('.')) continue
      const target = join(dir, reExport.specifier, INDEX_DTS_NAME)
      if (target === source || !entryIndexes.has(target)) continue
      edges.set(`${source}\0${reExport.exported}`, {
        hop: { source, exported: reExport.exported, specifier: reExport.specifier },
        next: `${target}\0${reExport.source}`,
      })
    }
  }
  const settled = createSet<string>([])
  const cycles: AliasHop[][] = []
  for (const start of edges.keys()) {
    const keys: string[] = []
    const hops: AliasHop[] = []
    let key = start
    let edge = edges.get(key)
    // why: a walk stops at a name an entry declares (no edge) or at a name an earlier walk settled, so every cycle is reported from one start alone
    while (edge !== undefined && !settled.has(key)) {
      const loop = keys.indexOf(key)
      if (loop !== -1) {
        cycles.push(hops.slice(loop))
        break
      }
      keys.push(key)
      hops.push(edge.hop)
      key = edge.next
      edge = edges.get(key)
    }
    for (const step of keys) settled.add(step)
  }
  return cycles
}

/**
 * Renders one alias cycle as the hops that form it.
 *
 * @param context - Resolved build context, for output-relative paths.
 * @param cycle - The hops in re-export order.
 * @returns One line naming every hop.
 */
const describeCycle = (context: BuildContext, cycle: AliasHop[]): string =>
  cycle.map((hop) => `${relativePath(context.outputPath, hop.source)} re-exports ${hop.exported} from '${hop.specifier}'`).join(', and ')

/**
 * Fails the build when the emitted entry declarations reference symbols a
 * sibling entry does not export, or re-export a name around a cycle of entries,
 * so a package can never publish a type surface that silently resolves to `any`
 * in consumer code.
 *
 * @param context - Resolved build context.
 * @throws {Error} When any cross-entry reference names an unexported symbol or aliases itself.
 *
 * @example Verifying the type surface after the declaration passes
 * ```typescript
 * verifyEntryTypeRefs(context)
 * ```
 */
export const verifyEntryTypeRefs = (context: BuildContext): void => {
  const dangling = findDanglingEntryRefs(context)
  if (dangling.length === 0) {
    const cycles = findAliasCycles(context)
    if (cycles.length === 0) {
      log.debug('entry type references resolve')
      return
    }
    throw createError(
      `${cycles.length} declaration alias cycle(s) between entries, which TypeScript rejects as TS2303 in consumers that type-check declarations:\n${cycles.map((cycle) => `  ${describeCycle(context, cycle)}`).join('\n')}\nRe-export each name from the entry that declares it alone.`
    )
  }
  const details = dangling
    .map(
      (ref) =>
        `  ${relativePath(context.outputPath, ref.source)} references ${ref.missing.join(', ')} from '${ref.specifier}', which ${relativePath(context.outputPath, ref.target)} does not export`
    )
    .join('\n')
  throw createError(
    `${dangling.length} cross-entry type reference(s) name symbols the target entry does not export:\n${details}\nExport each name from that entry's index — it is already part of the entry's public type surface.`
  )
}
