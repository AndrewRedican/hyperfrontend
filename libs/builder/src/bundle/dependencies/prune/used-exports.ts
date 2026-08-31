import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { classifyRequireBinding, getRequireSpecifier, parseChunk, resolveRelativeTarget } from './ast-utils'

/**
 * Per-chunk usage demand from a single importer set: either the concrete set of
 * exported names referenced, or `'all'`: the safety sentinel meaning the
 * importer consumes the chunk wholesale (namespace/default import, or a `require`
 * binding escaping member access) so nothing may be stripped.
 */
export type ImportUsage = Set<string> | 'all'

/** Module output format of the chunks being analyzed. */
export type ChunkFormat = 'esm' | 'cjs'

const mergeName = (edges: Map<string, ImportUsage>, target: string, name: string): void => {
  const current = edges.get(target)
  if (current === 'all') return
  if (current) current.add(name)
  else edges.set(target, createSet([name]))
}

const mergeAll = (edges: Map<string, ImportUsage>, target: string): void => void edges.set(target, 'all')

// why: a side-effect-only import (`import './x'`) reaches a chunk without naming any export; record it with an empty demand so the orphan re-sweep, not the export stripper, decides its fate.
const markReached = (edges: Map<string, ImportUsage>, target: string): void => void (edges.has(target) || edges.set(target, createSet([])))

const collectEsmEdges = (sourceFile: ts.SourceFile, importerDir: string, edges: Map<string, ImportUsage>): void => {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      // why: an `ImportDeclaration`'s module specifier is always a string literal in parseable source.
      const target = resolveRelativeTarget(importerDir, (statement.moduleSpecifier as ts.StringLiteral).text)
      if (target === null) continue
      const clause = statement.importClause
      if (!clause) {
        markReached(edges, target)
        continue
      }
      // why: `import def from 'F'` pulls the default export — consume the whole surface to stay safe.
      if (clause.name) {
        mergeAll(edges, target)
        continue
      }
      // why: with no default binding, a parseable import always carries named bindings — either `* as ns` or `{ … }`.
      const bindings = clause.namedBindings as ts.NamedImportBindings
      if (ts.isNamespaceImport(bindings)) {
        mergeAll(edges, target)
        continue
      }
      for (const element of bindings.elements) mergeName(edges, target, (element.propertyName ?? element.name).text)
      continue
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      // why: a re-export's module specifier, when present, is always a string literal in parseable source.
      const target = resolveRelativeTarget(importerDir, (statement.moduleSpecifier as ts.StringLiteral).text)
      if (target === null) continue
      // why: `export * from 'F'` re-exports the entire surface — treat as wholesale demand.
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
        mergeAll(edges, target)
        continue
      }
      for (const element of statement.exportClause.elements) mergeName(edges, target, (element.propertyName ?? element.name).text)
    }
  }
}

const collectCjsBindingEdges = (
  node: ts.CallExpression,
  target: string,
  edges: Map<string, ImportUsage>,
  namespaceBindings: Map<string, string>,
  declNames: Set<ts.Node>
): void => {
  const shape = classifyRequireBinding(node)
  switch (shape.kind) {
    case 'prop':
      mergeName(edges, target, shape.name)
      return
    // why: inline element access (`require('./x')['foo']`, static or computed) keeps the whole chunk — this pass never narrowed it, and preserving that is safe (the namespace-usage pass narrows the static case). Narrowing here would be a separate enhancement.
    case 'elem-static':
    case 'elem-dynamic':
      mergeAll(edges, target)
      return
    // why: a bare `require('./x')` statement pulls the chunk only for its side effects, naming no export; record it reached with empty demand — mirroring an ESM side-effect import — so the orphan re-sweep, not the export stripper, decides its fate.
    case 'side-effect':
      markReached(edges, target)
      return
    case 'ns-binding':
      namespaceBindings.set(shape.name.text, target)
      declNames.add(shape.name)
      return
    case 'destructure':
      for (const element of shape.pattern.elements) {
        // why: a rest element (`...rest`) captures every remaining export, so the surface must be kept whole.
        if (element.dotDotDotToken) {
          mergeAll(edges, target)
          continue
        }
        const key = element.propertyName ?? element.name
        if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) mergeName(edges, target, key.text)
        else mergeAll(edges, target)
      }
      return
    // why: a `require` used as a call argument, spread, or any non-binding position escapes member tracking — keep the whole chunk.
    case 'escape':
      mergeAll(edges, target)
      return
  }
}

const scanNamespaceUse = (
  identifier: ts.Identifier,
  namespaceBindings: Map<string, string>,
  edges: Map<string, ImportUsage>,
  declNames: Set<ts.Node>
): void => {
  const target = namespaceBindings.get(identifier.text)
  if (target === undefined || declNames.has(identifier)) return
  const parent = identifier.parent
  if (ts.isPropertyAccessExpression(parent) && parent.expression === identifier && ts.isIdentifier(parent.name)) {
    mergeName(edges, target, parent.name.text)
    return
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === identifier) {
    if (ts.isStringLiteralLike(parent.argumentExpression)) mergeName(edges, target, parent.argumentExpression.text)
    else mergeAll(edges, target)
    return
  }
  // why: the binding name appearing as another object's property key is unrelated; every other position is a wholesale escape.
  if (!(ts.isPropertyAccessExpression(parent) && parent.name === identifier)) mergeAll(edges, target)
}

const collectCjsEdges = (sourceFile: ts.SourceFile, importerDir: string, edges: Map<string, ImportUsage>): void => {
  const namespaceBindings = createMap<string, string>()
  const declNames = createSet<ts.Node>([])
  const findRequires = (node: ts.Node): void => {
    const specifier = getRequireSpecifier(node)
    if (specifier !== null) {
      const target = resolveRelativeTarget(importerDir, specifier)
      if (target !== null) collectCjsBindingEdges(node as ts.CallExpression, target, edges, namespaceBindings, declNames)
    }
    ts.forEachChild(node, findRequires)
  }
  findRequires(sourceFile)
  if (namespaceBindings.size === 0) return
  const scanUses = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) scanNamespaceUse(node, namespaceBindings, edges, declNames)
    ts.forEachChild(node, scanUses)
  }
  scanUses(sourceFile)
}

/**
 * Builds the map of chunk → exported-name demand for every relative module edge
 * a single importer declares.
 *
 * Each key is the absolute path the importer references; each value is the set
 * of exported names it pulls from that chunk, or `'all'` when the reference is
 * wholesale (namespace/default import, `export *`, or a `require` binding that
 * escapes member access). A side-effect-only `import './x'` records the target
 * with an empty set.
 *
 * @param source - Raw importer source text.
 * @param importerDir - Absolute directory of the importer file.
 * @param format - Module format that determines ESM vs CJS edge extraction.
 * @returns Map from resolved chunk path to its usage demand.
 *
 * @example Edges of an ESM entry
 * ```typescript
 * collectImportEdges("import { getType } from './_dependencies/x/index.esm.js'", '/dist/libs/foo', 'esm')
 * // => Map { '/dist/libs/foo/_dependencies/x/index.esm.js' => Set { 'getType' } }
 * ```
 */
export const collectImportEdges = (source: string, importerDir: string, format: ChunkFormat): Map<string, ImportUsage> => {
  const sourceFile = parseChunk(source)
  const edges = createMap<string, ImportUsage>()
  if (format === 'esm') collectEsmEdges(sourceFile, importerDir, edges)
  else collectCjsEdges(sourceFile, importerDir, edges)
  return edges
}
