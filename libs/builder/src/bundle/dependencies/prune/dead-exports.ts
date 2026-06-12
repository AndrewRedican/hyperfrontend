import type { ExportEntry } from './chunk-graph'
import type { ChunkFormat, ImportUsage } from './used-exports'
import ts from 'typescript'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { parseChunk } from './ast-utils'
import { analyzeChunk, collectRefs, computeKeepClosure, requireBindingLocals } from './chunk-graph'

/**
 * Outcome of stripping a single chunk.
 */
export interface StripResult {
  /** Rewritten chunk source with dead declarations and exports removed. */
  code: string
  /** Exported names that were spliced out. */
  removedNames: string[]
}

/** A single text replacement over the original source. */
interface Edit {
  /** Inclusive start offset. */
  start: number
  /** Exclusive end offset. */
  end: number
  /** Replacement text (empty string deletes the span). */
  text: string
}

const renderEsmExportList = (entries: ExportEntry[]): string =>
  `export { ${entries.map((entry) => (entry.exported === entry.local ? entry.local : `${entry.local} as ${entry.exported}`)).join(', ')} };`

const renderEsmImport = (elements: readonly ts.ImportSpecifier[], specifierText: string): string => {
  const bindings = elements.map((element) => {
    const imported = (element.propertyName ?? element.name).text
    return imported === element.name.text ? imported : `${imported} as ${element.name.text}`
  })
  return `import { ${bindings.join(', ')} } from ${specifierText};`
}

const narrowEsmImport = (statement: ts.ImportDeclaration, usedNames: Set<string>, sourceFile: ts.SourceFile, edits: Edit[]): void => {
  const clause = statement.importClause
  // why: default and namespace imports bind the whole module object — never narrowed.
  if (!clause || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return
  const surviving = clause.namedBindings.elements.filter((element) => usedNames.has(element.name.text))
  if (surviving.length === clause.namedBindings.elements.length) return
  if (surviving.length === 0) edits.push({ start: statement.getFullStart(), end: statement.getEnd(), text: '' })
  else
    edits.push({
      start: statement.getStart(sourceFile),
      end: statement.getEnd(),
      text: renderEsmImport(surviving, statement.moduleSpecifier.getText(sourceFile)),
    })
}

const narrowCjsRequire = (statement: ts.Statement, usedNames: Set<string>, edits: Edit[]): void => {
  const locals = requireBindingLocals(statement)
  if (locals.length > 0 && locals.every((local) => !usedNames.has(local)))
    edits.push({ start: statement.getFullStart(), end: statement.getEnd(), text: '' })
}

const collectExportEdits = (exports: ExportEntry[], removedLocals: Set<string>, sourceFile: ts.SourceFile, edits: Edit[]): void => {
  const listGroups = createMap<ts.Statement, ExportEntry[]>()
  for (const entry of exports) {
    if (entry.kind === 'cjs-assign' && removedLocals.has(entry.local))
      edits.push({ start: entry.statement.getFullStart(), end: entry.statement.getEnd(), text: '' })
    if (entry.kind !== 'esm-list') continue
    const group = listGroups.get(entry.statement) ?? []
    group.push(entry)
    listGroups.set(entry.statement, group)
  }
  for (const [statement, group] of listGroups) {
    const surviving = group.filter((entry) => !removedLocals.has(entry.local))
    if (surviving.length === group.length) continue
    if (surviving.length === 0) edits.push({ start: statement.getFullStart(), end: statement.getEnd(), text: '' })
    else edits.push({ start: statement.getStart(sourceFile), end: statement.getEnd(), text: renderEsmExportList(surviving) })
  }
}

const applyEdits = (source: string, edits: Edit[]): string => {
  let code = source
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) code = `${code.slice(0, edit.start)}${edit.text}${code.slice(edit.end)}`
  // why: splicing whole statements leaves runs of blank lines; collapse them so the trimmed chunk stays readable.
  return code.replace(/\n{3,}/g, '\n\n')
}

/**
 * Removes guaranteed-dead exported declarations (and the now-dead private code
 * and imports they pulled in) from a single chunk's source.
 *
 * Builds the chunk's declaration/export model, computes the keep-closure from
 * the importer-supplied `keep` demand, and splices out every side-effect-free
 * top-level declaration that no kept declaration, kept export, or bare
 * side-effecting statement references. The matching entries are dropped from the
 * export surface, and import bindings left unreferenced by the surviving code are
 * narrowed away (whole import statements when fully unused) — which is what
 * shrinks the cross-chunk dependency graph for the next fixpoint pass.
 * Side-effecting initializers and bare statements are always kept.
 *
 * @param source - Raw chunk source text.
 * @param format - Module format of the chunk.
 * @param keep - Exported names importers demand, or `'all'` to keep everything.
 * @returns The rewritten source and removed export names, or `null` when nothing
 * could be removed.
 *
 * @example Stripping all but one export from a chunk
 * ```typescript
 * stripDeadExports(source, 'esm', createSet(['getType']))
 * ```
 */
export const stripDeadExports = (source: string, format: ChunkFormat, keep: ImportUsage): StripResult | null => {
  if (keep === 'all') return null
  const sourceFile = parseChunk(source)
  const model = analyzeChunk(sourceFile, format)
  const keepClosure = computeKeepClosure(sourceFile, model, keep)
  const removableDecls = model.decls.filter((decl) => decl.sideEffectFree && decl.names.every((name) => !keepClosure.has(name)))
  if (removableDecls.length === 0) return null

  const removedLocals = createSet<string>([])
  for (const decl of removableDecls) for (const name of decl.names) removedLocals.add(name)
  const removeSet = createSet<ts.Statement>(removableDecls.map((decl) => decl.statement))
  const removedNames = createSet<string>([])
  for (const entry of model.exports) if (removedLocals.has(entry.local)) removedNames.add(entry.exported)

  const usedNames = createSet<string>([])
  for (const statement of sourceFile.statements) {
    if (model.importStatements.includes(statement) || removeSet.has(statement)) continue
    collectRefs(statement, usedNames)
  }

  const edits: Edit[] = removableDecls.map((decl) => ({ start: decl.statement.getFullStart(), end: decl.statement.getEnd(), text: '' }))
  collectExportEdits(model.exports, removedLocals, sourceFile, edits)
  for (const statement of model.importStatements) {
    if (format === 'esm') narrowEsmImport(<ts.ImportDeclaration>statement, usedNames, sourceFile, edits)
    else narrowCjsRequire(statement, usedNames, edits)
  }
  return { code: applyEdits(source, edits), removedNames: from(removedNames) }
}
