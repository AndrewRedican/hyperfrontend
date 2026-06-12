import type { ChunkFormat } from './used-exports'
import ts from 'typescript'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { getRequireSpecifier } from './ast-utils'

/**
 * A removable-candidate top-level declaration: a `function`/`class`/`var`
 * statement and the names it binds, tagged with whether evaluating it is free
 * of observable side effects.
 */
export interface DeclInfo {
  /** The owning top-level statement. */
  statement: ts.Statement
  /** Every name the statement binds (one for func/class, ≥1 for `var`). */
  names: string[]
  /** True when the statement may be deleted without dropping a side effect. */
  sideEffectFree: boolean
}

/**
 * One entry in a chunk's public export surface, linking an exported name to the
 * local declaration that backs it and the statement that declares the export.
 */
export interface ExportEntry {
  /** The name visible to importers. */
  exported: string
  /** The local declaration name the export resolves to. */
  local: string
  /** The statement that publishes the export. */
  statement: ts.Statement
  /** Shape of the export site, governing how it is edited when pruned. */
  kind: 'esm-list' | 'esm-inline' | 'cjs-assign'
}

/**
 * Structural model of a single bundled chunk used to drive dead-export removal.
 */
export interface ChunkModel {
  /** Map from each declared name to its declaration. */
  nameToDecl: Map<string, DeclInfo>
  /** Unique declarations in source order. */
  decls: DeclInfo[]
  /** Statements that are import sites (ESM `import` or CJS `require` bindings). */
  importStatements: ts.Statement[]
  /** The chunk's export surface. */
  exports: ExportEntry[]
  /** Statements that publish exports via a separate `export { … }` / `exports.x =` site. */
  exportSurfaceStatements: Set<ts.Statement>
}

const EVAL_SIDE_EFFECT_KINDS = createSet<ts.SyntaxKind>([
  ts.SyntaxKind.CallExpression,
  ts.SyntaxKind.NewExpression,
  ts.SyntaxKind.AwaitExpression,
  ts.SyntaxKind.YieldExpression,
  ts.SyntaxKind.TaggedTemplateExpression,
])

// why: a call/new/await reached while evaluating the initializer is a real side effect; one nested inside a function/arrow body runs later, so traversal must not descend into those bodies.
const containsEvalSideEffect = (node: ts.Node): boolean => {
  let found = false
  const visit = (current: ts.Node): void => {
    if (found || ts.isFunctionLike(current)) return
    if (EVAL_SIDE_EFFECT_KINDS.has(current.kind)) {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

const isSideEffectFreeInitializer = (initializer: ts.Expression | undefined): boolean =>
  initializer === undefined || !containsEvalSideEffect(initializer)

/**
 * Collects the identifier names referenced within a node, excluding identifiers
 * that sit in a property-name position (`obj.name`, `{ name: … }`, `{ name: x }`
 * binding keys) since those never refer to a top-level declaration.
 *
 * Deliberately over-approximates: a name captured that is not actually a
 * top-level declaration is harmless, and capturing more only keeps more code.
 *
 * @param node - The subtree to scan.
 * @param sink - Set that receives every referenced identifier name.
 *
 * @example Collecting references inside a function body
 * ```typescript
 * const refs = createSet<string>([])
 * collectRefs(functionDeclaration, refs)
 * ```
 */
export const collectRefs = (node: ts.Node, sink: Set<string>): void => {
  const visit = (current: ts.Node): void => {
    if (ts.isIdentifier(current)) {
      const parent = current.parent
      if (ts.isPropertyAccessExpression(parent) && parent.name === current) return
      if (ts.isPropertyAssignment(parent) && parent.name === current) return
      if (ts.isBindingElement(parent) && parent.propertyName === current) return
      sink.add(current.text)
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
}

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)

const isRequireInitializer = (init: ts.Expression): boolean =>
  getRequireSpecifier(init) !== null || (ts.isPropertyAccessExpression(init) && getRequireSpecifier(init.expression) !== null)

const isRequireVarStatement = (statement: ts.Statement): boolean =>
  ts.isVariableStatement(statement) &&
  statement.declarationList.declarations.some((decl) => decl.initializer !== undefined && isRequireInitializer(decl.initializer))

/**
 * Returns the local binding names introduced by a CJS `require` variable
 * statement, across identifier and object-destructure bindings.
 *
 * @param statement - A variable statement known to bind a `require` call.
 * @returns The local names it introduces.
 *
 * @example Bindings of a destructured require
 * ```typescript
 * // for `var { a, b } = require('./x.cjs.js')`
 * requireBindingLocals(statement) // => ['a', 'b']
 * ```
 */
export const requireBindingLocals = (statement: ts.Statement): string[] => {
  const locals: string[] = []
  if (!ts.isVariableStatement(statement)) return locals
  for (const decl of statement.declarationList.declarations) {
    if (ts.isIdentifier(decl.name)) locals.push(decl.name.text)
    else if (ts.isObjectBindingPattern(decl.name))
      for (const element of decl.name.elements) if (ts.isIdentifier(element.name)) locals.push(element.name.text)
  }
  return locals
}

const tryDecl = (statement: ts.Statement): DeclInfo | null => {
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
    return { statement, names: [statement.name.text], sideEffectFree: true }
  }
  if (!ts.isVariableStatement(statement)) return null
  const names: string[] = []
  let sideEffectFree = true
  for (const decl of statement.declarationList.declarations) {
    // why: a destructured top-level binding is not a simple named export and its initializer is typically a call — never treat it as a removable declaration.
    if (!ts.isIdentifier(decl.name)) return null
    names.push(decl.name.text)
    if (!isSideEffectFreeInitializer(decl.initializer)) sideEffectFree = false
  }
  return { statement, names, sideEffectFree }
}

const collectEsmExports = (statement: ts.Statement, entries: ExportEntry[], surface: Set<ts.Statement>): void => {
  if (
    ts.isExportDeclaration(statement) &&
    !statement.moduleSpecifier &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
  ) {
    surface.add(statement)
    for (const element of statement.exportClause.elements)
      entries.push({ exported: element.name.text, local: (element.propertyName ?? element.name).text, statement, kind: 'esm-list' })
    return
  }
  if (!hasExportModifier(statement)) return
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
    entries.push({ exported: statement.name.text, local: statement.name.text, statement, kind: 'esm-inline' })
  } else if (ts.isVariableStatement(statement)) {
    for (const decl of statement.declarationList.declarations)
      if (ts.isIdentifier(decl.name)) entries.push({ exported: decl.name.text, local: decl.name.text, statement, kind: 'esm-inline' })
  }
}

const collectCjsExports = (statement: ts.Statement, entries: ExportEntry[], surface: Set<ts.Statement>): void => {
  if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) return
  const { left, operatorToken, right } = statement.expression
  if (operatorToken.kind !== ts.SyntaxKind.EqualsToken) return
  if (
    ts.isPropertyAccessExpression(left) &&
    ts.isIdentifier(left.expression) &&
    left.expression.text === 'exports' &&
    ts.isIdentifier(left.name) &&
    ts.isIdentifier(right)
  ) {
    surface.add(statement)
    entries.push({ exported: left.name.text, local: right.text, statement, kind: 'cjs-assign' })
  }
}

/**
 * Builds the structural model of a chunk: its removable declarations, import
 * sites, and export surface.
 *
 * @param sourceFile - The parsed chunk.
 * @param format - Module format selecting ESM vs CJS export/import shapes.
 * @returns The chunk model consumed by {@link computeKeepClosure} and the stripper.
 *
 * @example Modeling an ESM chunk
 * ```typescript
 * const model = analyzeChunk(parseChunk(source), 'esm')
 * ```
 */
export const analyzeChunk = (sourceFile: ts.SourceFile, format: ChunkFormat): ChunkModel => {
  const nameToDecl = createMap<string, DeclInfo>()
  const decls: DeclInfo[] = []
  const importStatements: ts.Statement[] = []
  const exports: ExportEntry[] = []
  const exportSurfaceStatements = createSet<ts.Statement>([])
  for (const statement of sourceFile.statements) {
    if (format === 'esm' ? ts.isImportDeclaration(statement) : isRequireVarStatement(statement)) {
      importStatements.push(statement)
      continue
    }
    const decl = tryDecl(statement)
    if (decl) {
      decls.push(decl)
      for (const name of decl.names) nameToDecl.set(name, decl)
    }
    if (format === 'esm') collectEsmExports(statement, exports, exportSurfaceStatements)
    else collectCjsExports(statement, exports, exportSurfaceStatements)
  }
  return { nameToDecl, decls, importStatements, exports, exportSurfaceStatements }
}

const collectRoots = (sourceFile: ts.SourceFile, model: ChunkModel, keep: Set<string>, declStatements: Set<ts.Statement>): Set<string> => {
  const roots = createSet<string>([])
  for (const entry of model.exports) if (keep.has(entry.exported)) roots.add(entry.local)
  for (const decl of model.decls) if (!decl.sideEffectFree) for (const name of decl.names) roots.add(name)
  for (const statement of sourceFile.statements) {
    if (declStatements.has(statement) || model.exportSurfaceStatements.has(statement) || model.importStatements.includes(statement))
      continue
    collectRefs(statement, roots)
  }
  return roots
}

/**
 * Computes the closure of local declaration names that must be retained: every
 * kept export, every side-effecting declaration, every name referenced by a
 * bare top-level statement, and everything those transitively reference.
 *
 * @param sourceFile - The parsed chunk.
 * @param model - The chunk model from {@link analyzeChunk}.
 * @param keep - Exported names demanded by importers.
 * @returns The set of local names that may not be removed.
 *
 * @example Names that survive given a one-export demand
 * ```typescript
 * const live = computeKeepClosure(sourceFile, model, createSet(['getType']))
 * ```
 */
export const computeKeepClosure = (sourceFile: ts.SourceFile, model: ChunkModel, keep: Set<string>): Set<string> => {
  const declStatements = createSet<ts.Statement>(model.decls.map((decl) => decl.statement))
  const refsCache = createMap<ts.Statement, Set<string>>()
  const refsOf = (statement: ts.Statement): Set<string> => {
    const cached = refsCache.get(statement)
    if (cached) return cached
    const refs = createSet<string>([])
    collectRefs(statement, refs)
    refsCache.set(statement, refs)
    return refs
  }
  const keepClosure = createSet<string>([])
  const stack = from(collectRoots(sourceFile, model, keep, declStatements))
  while (stack.length > 0) {
    const name = <string>stack.pop()
    if (keepClosure.has(name)) continue
    keepClosure.add(name)
    const decl = model.nameToDecl.get(name)
    if (!decl) continue
    for (const ref of refsOf(decl.statement)) if (!keepClosure.has(ref)) stack.push(ref)
  }
  return keepClosure
}
