import type { Edit } from './edits'
import type { PropDemand } from './namespace-usage'
import type { ChunkFormat } from './used-exports'
import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { parseChunk } from './ast-utils'
import { analyzeChunk, collectBindingCanonical, isPureFreezeCall } from './chunk-graph'
import { applyEdits } from './edits'
import { classifyNamespaceUse, mergeDemand } from './namespace-usage'

/** One property slot of a frozen namespace literal, paired with the element node that materializes it. */
interface NamespaceProperty {
  /** The property key. */
  name: string
  /** The object-literal element to keep or splice. */
  element: ts.ObjectLiteralElementLike
}

/** A frozen, exported namespace object whose slots may be partitioned by consumer demand. */
interface NamespaceObject {
  /** The public export name consumers import. */
  exported: string
  /** The local binding name. */
  local: string
  /** The owning `const`/`var` statement. */
  statement: ts.Statement
  /** The frozen object literal. */
  literal: ts.ObjectLiteralExpression
  /** Every slot of the literal, in source order. */
  properties: NamespaceProperty[]
}

/** Plain (node-free) description of a chunk's frozen namespace exports. */
export interface NamespaceInfo {
  /** The public export name. */
  exported: string
  /** Property names the literal defines, in source order. */
  properties: string[]
}

/** Analysis of one chunk: its namespace exports plus the demand its own body places on them. */
export interface ChunkNamespaceAnalysis {
  /** Frozen namespace exports found in the chunk. */
  namespaces: NamespaceInfo[]
  /** Demand the chunk's own statements place on its namespace exports (internal `NS.prop` reads or wholesale escapes). */
  selfDemand: Map<string, PropDemand>
}

const propertyName = (element: ts.ObjectLiteralElementLike): string | null => {
  if (ts.isShorthandPropertyAssignment(element)) return element.name.text
  if (ts.isPropertyAssignment(element) && (ts.isIdentifier(element.name) || ts.isStringLiteralLike(element.name))) return element.name.text
  return null
}

// why: only a literal of plain `key: value` / shorthand slots can be safely partitioned; a spread, computed key, method, or accessor makes per-slot removal unsound, so such a literal is left whole (no NamespaceObject yielded).
const readProperties = (literal: ts.ObjectLiteralExpression): NamespaceProperty[] | null => {
  const properties: NamespaceProperty[] = []
  for (const element of literal.properties) {
    const name = propertyName(element)
    if (name === null) return null
    properties.push({ name, element })
  }
  return properties
}

const exportedLocalNames = (sourceFile: ts.SourceFile, format: ChunkFormat): Map<string, string> => {
  const single = createMap<string, string>()
  const seen = createSet<string>([])
  for (const entry of analyzeChunk(sourceFile, format).exports) {
    // why: a local published under two names cannot be keyed to one demand set — drop it from the strippable set.
    if (seen.has(entry.local)) single.delete(entry.local)
    else {
      seen.add(entry.local)
      single.set(entry.local, entry.exported)
    }
  }
  return single
}

// context: visits each exported, frozen, plain-slot namespace object in source order. A namespace is a single-declarator top-level `const`/`var` whose initializer is a recognized pure freeze (`Object.freeze`/`seal`/`preventExtensions`, however aliased) of a fresh object literal, and whose local is exported under exactly one name.
const forEachNamespaceObject = (sourceFile: ts.SourceFile, format: ChunkFormat, visit: (object: NamespaceObject) => void): void => {
  const exported = exportedLocalNames(sourceFile, format)
  const resolution = collectBindingCanonical(sourceFile)
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) continue
    const decl = statement.declarationList.declarations[0]
    if (!decl || !ts.isIdentifier(decl.name)) continue
    const name = decl.name.text
    const exportName = exported.get(name)
    if (exportName === undefined || !decl.initializer || !ts.isCallExpression(decl.initializer)) continue
    if (!isPureFreezeCall(decl.initializer, resolution)) continue
    const argument = decl.initializer.arguments[0]
    if (!argument || !ts.isObjectLiteralExpression(argument)) continue
    const properties = readProperties(argument)
    if (properties === null) continue
    visit({ exported: exportName, local: name, statement, literal: argument, properties })
  }
}

/**
 * Analyzes a single chunk for frozen namespace exports and the demand its own
 * body places on them.
 *
 * Returns the namespace exports as node-free data (so the parsed source can be
 * released) and a self-demand map folding every reference to a namespace's local
 * binding outside its own declaration and export surface: a static `NS.prop`
 * read contributes that property, any other use marks the namespace `'all'`.
 *
 * @param source - Raw chunk source text.
 * @param format - Module format selecting the export shape.
 * @returns The chunk's namespace exports and the demand it self-imposes.
 *
 * @example A chunk that exports a frozen namespace it never self-references
 * ```typescript
 * analyzeChunkNamespaces('const a = 1;\nconst NS = Object.freeze({ a });\nexport { a, NS };', 'esm')
 * // => { namespaces: [{ exported: 'NS', properties: ['a'] }], selfDemand: Map {} }
 * ```
 */
export const analyzeChunkNamespaces = (source: string, format: ChunkFormat): ChunkNamespaceAnalysis => {
  const sourceFile = parseChunk(source)
  const namespaces: NamespaceInfo[] = []
  const localToExport = createMap<string, string>()
  const skip = createSet<ts.Statement>([])
  forEachNamespaceObject(sourceFile, format, (object) => {
    namespaces.push({ exported: object.exported, properties: object.properties.map((property) => property.name) })
    localToExport.set(object.local, object.exported)
    skip.add(object.statement)
  })
  const selfDemand = createMap<string, PropDemand>()
  if (namespaces.length === 0) return { namespaces, selfDemand }
  // why: a namespace's own declaration and its `export { … }` site are not consumer reads — skip them so only genuine internal uses count.
  for (const entry of analyzeChunk(sourceFile, format).exportSurfaceStatements) skip.add(entry)
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const exportName = localToExport.get(node.text)
      if (exportName !== undefined) {
        const classification = classifyNamespaceUse(node)
        if (classification.kind === 'read') mergeDemand(selfDemand, exportName, createSet<string>([classification.prop]))
        else if (classification.kind === 'bail') mergeDemand(selfDemand, exportName, 'all')
      }
    }
    ts.forEachChild(node, visit)
  }
  for (const statement of sourceFile.statements) if (!skip.has(statement)) visit(statement)
  return { namespaces, selfDemand }
}

/**
 * Outcome of stripping unread slots from a chunk's frozen namespace literals.
 */
export interface PropertyStripResult {
  /** Rewritten chunk source with the unread slots removed from each namespace literal. */
  code: string
  /** Number of slots removed across all namespaces in the chunk. */
  removedProperties: number
}

/**
 * Rewrites a chunk's frozen namespace literals to keep only the slots the
 * consumer graph reads, dropping the rest.
 *
 * For every exported frozen namespace, `keepByExport` supplies the property names
 * to retain (the read set already intersected with the literal's own slots). A
 * namespace absent from the map, or whose kept set is empty or covers every
 * slot, is left untouched. Dropping a slot removes the only reference its factory
 * binding had, so the subsequent dead-export pass collapses the now-dead
 * factories — this pass only edits the literal.
 *
 * @param source - Raw chunk source text.
 * @param format - Module format selecting the export shape.
 * @param keepByExport - Per-export set of property names to retain.
 * @returns The rewritten source and slot-removal count, or `null` when nothing changed.
 *
 * @example Keeping a single slot of a two-slot namespace
 * ```typescript
 * stripDeadProperties('const a=1;\nconst b=2;\nconst NS=Object.freeze({a,b});\nexport{NS};', 'esm', new Map([['NS', new Set(['a'])]]))
 * // => literal rewritten to `{ a }`, removedProperties: 1
 * ```
 */
export const stripDeadProperties = (
  source: string,
  format: ChunkFormat,
  keepByExport: Map<string, Set<string>>
): PropertyStripResult | null => {
  const sourceFile = parseChunk(source)
  const edits: Edit[] = []
  let removedProperties = 0
  forEachNamespaceObject(sourceFile, format, (object) => {
    const keep = keepByExport.get(object.exported)
    if (!keep) return
    const survivors = object.properties.filter((property) => keep.has(property.name))
    // why: never produce an empty `freeze({})` and never rewrite when nothing is dropped.
    if (survivors.length === 0 || survivors.length === object.properties.length) return
    removedProperties += object.properties.length - survivors.length
    const rendered = survivors.map((property) => source.slice(property.element.getStart(sourceFile), property.element.getEnd()))
    edits.push({ start: object.literal.getStart(sourceFile), end: object.literal.getEnd(), text: `{ ${rendered.join(', ')} }` })
  })
  if (edits.length === 0) return null
  return { code: applyEdits(source, edits), removedProperties }
}
