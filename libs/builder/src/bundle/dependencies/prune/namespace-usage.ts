import type { ChunkFormat } from './used-exports'
import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { getRequireSpecifier, parseChunk, resolveRelativeTarget } from './ast-utils'

/**
 * Property-level demand on a single namespace export: either the concrete set of
 * property names statically read off it, or `'all'` — the safety sentinel
 * meaning the binding is consumed in a way that forbids dropping any slot
 * (spread, passed/returned/assigned wholesale, enumerated, dynamically indexed,
 * or re-exported).
 */
export type PropDemand = Set<string> | 'all'

/**
 * How one importer (or the defining chunk itself) consumes the namespace exports
 * of a single target chunk.
 */
export interface NamespaceTargetUsage {
  /** True when the target is imported wholesale (namespace/default import, `export *`), so no export of it is strippable. */
  bailAll: boolean
  /** Per-export-name property demand for the target's named imports. */
  perName: Map<string, PropDemand>
}

/**
 * Merges a property demand into a per-export demand map, with `'all'` absorbing.
 *
 * @param demand - Map from export name to its accumulated property demand.
 * @param name - The export name receiving the contribution.
 * @param contribution - Either a set of read property names or `'all'`.
 *
 * @example Accumulating two reads of the same export
 * ```typescript
 * mergeDemand(demand, 'SafeObject', createSet(['freeze']))
 * mergeDemand(demand, 'SafeObject', createSet(['keys'])) // => { SafeObject: { freeze, keys } }
 * ```
 */
export const mergeDemand = (demand: Map<string, PropDemand>, name: string, contribution: PropDemand): void => {
  const current = demand.get(name)
  if (current === 'all') return
  if (contribution === 'all') {
    demand.set(name, 'all')
    return
  }
  if (current) for (const prop of contribution) current.add(prop)
  else demand.set(name, createSet<string>([...contribution]))
}

/** A static read of one property off the namespace binding. */
export interface NamespaceReadUse {
  /** Discriminant. */
  kind: 'read'
  /** The property name read. */
  prop: string
}

/** A wholesale consumption that forbids dropping any slot. */
export interface NamespaceBailUse {
  /** Discriminant. */
  kind: 'bail'
}

/** An occurrence that does not reference the binding's value. */
export interface NamespaceIgnoreUse {
  /** Discriminant. */
  kind: 'ignore'
}

/**
 * Outcome of classifying one syntactic occurrence of a namespace binding.
 */
export type UseClassification = NamespaceReadUse | NamespaceBailUse | NamespaceIgnoreUse

/**
 * Classifies a single identifier occurrence of a namespace binding as a static
 * property read, a wholesale-escape that forbids stripping, or an unrelated
 * position that names something else.
 *
 * Only `NS.prop` and `NS["prop"]` are property reads; a dynamic `NS[k]`, a
 * spread, or any value position (call argument, assignment, return, re-export,
 * shorthand) is an escape. A value sitting as a member name (`obj.NS`),
 * object-literal key (`{ NS: … }`), or binding property name is unrelated. The
 * value is usually an identifier binding, but may be a member node (`dep.NS`)
 * when classifying the use of a CJS export selected off a require binding.
 *
 * @param node - The expression occurrence to classify (an identifier binding or a `dep.Export` member node).
 * @returns The classification of this occurrence.
 *
 * @example A static property read
 * ```typescript
 * // for the `NS` in `NS.freeze(x)`
 * classifyNamespaceUse(id) // => { kind: 'read', prop: 'freeze' }
 * ```
 */
export const classifyNamespaceUse = (node: ts.Expression): UseClassification => {
  const parent = node.parent
  if (ts.isPropertyAccessExpression(parent)) {
    // why: `obj.NS` — the value sits as the member name, not a use of the binding's value.
    if (parent.name === node) return { kind: 'ignore' }
    return { kind: 'read', prop: parent.name.text }
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === node) {
    // why: a literal `NS["freeze"]` is a known slot; a computed `NS[k]` could read any slot, so keep them all.
    return ts.isStringLiteralLike(parent.argumentExpression) ? { kind: 'read', prop: parent.argumentExpression.text } : { kind: 'bail' }
  }
  // why: `{ NS: … }` key and `{ NS: x } = …` binding key never reference the binding's value.
  if (ts.isPropertyAssignment(parent) && parent.name === node) return { kind: 'ignore' }
  if (ts.isBindingElement(parent) && parent.propertyName === node) return { kind: 'ignore' }
  return { kind: 'bail' }
}

// why: a member node `mod.Export` selects one export; classify how *that* member is then used (its `.prop` read, or a wholesale escape) and fold it into the export's demand. Shared by CJS whole-`require` namespace bindings and inline `require(...).Export` access.
const recordMemberUse = (memberNode: ts.Expression, exportName: string, usage: NamespaceTargetUsage): void => {
  const classification = classifyNamespaceUse(memberNode)
  if (classification.kind === 'read') mergeDemand(usage.perName, exportName, createSet<string>([classification.prop]))
  else mergeDemand(usage.perName, exportName, 'all')
}

/** A named import of one export from a resolved target chunk. */
interface TrackedImport {
  /** Absolute path of the chunk the export comes from. */
  target: string
  /** The export name as published by the target. */
  exportName: string
}

const ensureUsage = (edges: Map<string, NamespaceTargetUsage>, target: string): NamespaceTargetUsage => {
  const current = edges.get(target)
  if (current) return current
  const created: NamespaceTargetUsage = { bailAll: false, perName: createMap<string, PropDemand>() }
  edges.set(target, created)
  return created
}

const collectImports = (
  sourceFile: ts.SourceFile,
  importerDir: string,
  edges: Map<string, NamespaceTargetUsage>,
  locals: Map<string, TrackedImport>,
  bindingNodes: Set<ts.Node>
): void => {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const target = resolveRelativeTarget(importerDir, (<ts.StringLiteral>statement.moduleSpecifier).text)
      // why: a side-effect-only import has no clause and binds nothing to track.
      if (target === null || !statement.importClause) continue
      const clause = statement.importClause
      // why: a default import binds the whole module object — we cannot tell which export it aliases, so keep every namespace of the target.
      if (clause.name) ensureUsage(edges, target).bailAll = true
      const bindings = clause.namedBindings
      if (!bindings) continue
      if (ts.isNamespaceImport(bindings)) {
        ensureUsage(edges, target).bailAll = true
        continue
      }
      for (const element of bindings.elements) {
        locals.set(element.name.text, { target, exportName: (element.propertyName ?? element.name).text })
        bindingNodes.add(element.name)
        ensureUsage(edges, target)
      }
      continue
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const target = resolveRelativeTarget(importerDir, (<ts.StringLiteral>statement.moduleSpecifier).text)
      if (target === null) continue
      const usage = ensureUsage(edges, target)
      // why: `export * from 'F'` re-exports every name wholesale — keep the whole surface.
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
        usage.bailAll = true
        continue
      }
      // why: a re-export hands the namespace to another chunk's importers we cannot see — keep it whole (one-hop safety).
      for (const element of statement.exportClause.elements) mergeDemand(usage.perName, (element.propertyName ?? element.name).text, 'all')
    }
  }
}

const scanUse = (
  id: ts.Identifier,
  locals: Map<string, TrackedImport>,
  edges: Map<string, NamespaceTargetUsage>,
  bindingNodes: Set<ts.Node>
): void => {
  const tracked = locals.get(id.text)
  if (!tracked || bindingNodes.has(id)) return
  const usage = edges.get(tracked.target)
  // why: a target already marked wholesale needs no finer demand.
  if (!usage || usage.bailAll) return
  const classification = classifyNamespaceUse(id)
  if (classification.kind === 'read') mergeDemand(usage.perName, tracked.exportName, createSet<string>([classification.prop]))
  else if (classification.kind === 'bail') mergeDemand(usage.perName, tracked.exportName, 'all')
}

// why: a CJS `var dep = require('F')` reaches an export as `dep.Export`, so the property read is two-level (`dep.Export.prop`); a `var { Export } = require('F')` destructure binds the export directly (one-level, tracked like an ESM named import). This records both, plus inline `require('F').Export` access.
const bindRequire = (
  call: ts.CallExpression,
  target: string,
  edges: Map<string, NamespaceTargetUsage>,
  locals: Map<string, TrackedImport>,
  namespaceBindings: Map<string, string>,
  bindingNodes: Set<ts.Node>
): void => {
  const usage = ensureUsage(edges, target)
  const parent = call.parent
  // why: `require('F').Export …` — inline member access selecting one export; classify the member's own use.
  if (ts.isPropertyAccessExpression(parent) && parent.expression === call) {
    recordMemberUse(parent, parent.name.text, usage)
    return
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === call) {
    if (ts.isStringLiteralLike(parent.argumentExpression)) recordMemberUse(parent, parent.argumentExpression.text, usage)
    else usage.bailAll = true
    return
  }
  // why: a bare `require('./x')` statement binds nothing and reads no property — a side-effect-only import (mirrored from ESM, which skips clause-less imports) that forbids no slot; without this it falls through to the wholesale escape below and marks the whole target bailAll.
  if (ts.isExpressionStatement(parent)) return
  // why: a `require` not bound to a variable (call argument, spread, …) escapes member tracking — keep the whole target.
  if (!ts.isVariableDeclaration(parent) || parent.initializer !== call) {
    usage.bailAll = true
    return
  }
  if (ts.isIdentifier(parent.name)) {
    namespaceBindings.set(parent.name.text, target)
    bindingNodes.add(parent.name)
    return
  }
  if (ts.isObjectBindingPattern(parent.name)) {
    for (const element of parent.name.elements) {
      const key = element.propertyName ?? element.name
      // why: a rest element or a nested/computed binding captures more than one named export — keep the whole target.
      if (element.dotDotDotToken || !ts.isIdentifier(element.name) || !(ts.isIdentifier(key) || ts.isStringLiteralLike(key))) {
        usage.bailAll = true
        continue
      }
      locals.set(element.name.text, { target, exportName: key.text })
      bindingNodes.add(element.name)
    }
    return
  }
  usage.bailAll = true
}

const collectRequires = (
  sourceFile: ts.SourceFile,
  importerDir: string,
  edges: Map<string, NamespaceTargetUsage>,
  locals: Map<string, TrackedImport>,
  namespaceBindings: Map<string, string>,
  bindingNodes: Set<ts.Node>
): void => {
  const visit = (node: ts.Node): void => {
    const specifier = getRequireSpecifier(node)
    if (specifier !== null) {
      const target = resolveRelativeTarget(importerDir, specifier)
      if (target !== null) bindRequire(<ts.CallExpression>node, target, edges, locals, namespaceBindings, bindingNodes)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

const scanNamespaceBindingUse = (
  id: ts.Identifier,
  namespaceBindings: Map<string, string>,
  edges: Map<string, NamespaceTargetUsage>,
  bindingNodes: Set<ts.Node>
): void => {
  const target = namespaceBindings.get(id.text)
  if (target === undefined || bindingNodes.has(id)) return
  const usage = edges.get(target)
  if (!usage || usage.bailAll) return
  const parent = id.parent
  // why: `dep.Export …` — the member selects one export; classify how that member is used for the property read.
  if (ts.isPropertyAccessExpression(parent) && parent.expression === id) {
    recordMemberUse(parent, parent.name.text, usage)
    return
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === id) {
    // why: `dep["Export"]` selects a known export; `dep[k]` could select any, so keep every export of the target.
    if (ts.isStringLiteralLike(parent.argumentExpression)) recordMemberUse(parent, parent.argumentExpression.text, usage)
    else usage.bailAll = true
    return
  }
  // why: `obj.dep` — the binding sits as a member name, unrelated. Every other position consumes the module wholesale.
  if (!(ts.isPropertyAccessExpression(parent) && parent.name === id)) usage.bailAll = true
}

/**
 * Builds the per-target namespace-usage map an ESM importer declares: for every
 * relative chunk it imports, which exported names it reads at a strict set of
 * properties versus consumes wholesale.
 *
 * ESM named imports (`import { NS as L }`) and CJS destructured requires
 * (`const { NS: L } = require('F')`) bind an export to a local `L` tracked
 * one-level: every occurrence of `L` is classified. A CJS whole-module binding
 * (`const dep = require('F')`) is tracked two-level: `dep.NS.prop` reads the
 * property `prop` of export `NS`. A namespace/default import, `export *`, a
 * dynamic `dep[k]`, or any wholesale use of the module binding marks the target
 * `bailAll`; a re-export marks the re-exported name `'all'`. The importer is
 * parsed exactly once and released by the caller.
 *
 * @param source - Raw importer source text.
 * @param importerDir - Absolute directory of the importer file.
 * @param format - Module format selecting ESM `import` vs CJS `require` edges.
 * @returns Map from resolved chunk path to its namespace usage.
 *
 * @example Reading two slots off an imported namespace
 * ```typescript
 * collectNamespaceUsage("import { SafeObject } from './d/index.esm.js';\nSafeObject.freeze(x);\nSafeObject.keys(y);", '/dist/libs/foo', 'esm')
 * // => Map { '/dist/libs/foo/d/index.esm.js' => { bailAll: false, perName: { SafeObject: { freeze, keys } } } }
 * ```
 */
export const collectNamespaceUsage = (source: string, importerDir: string, format: ChunkFormat): Map<string, NamespaceTargetUsage> => {
  const edges = createMap<string, NamespaceTargetUsage>()
  const sourceFile = parseChunk(source)
  const locals = createMap<string, TrackedImport>()
  const namespaceBindings = createMap<string, string>()
  const bindingNodes = createSet<ts.Node>([])
  if (format === 'esm') collectImports(sourceFile, importerDir, edges, locals, bindingNodes)
  else collectRequires(sourceFile, importerDir, edges, locals, namespaceBindings, bindingNodes)
  if (locals.size === 0 && namespaceBindings.size === 0) return edges
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      scanUse(node, locals, edges, bindingNodes)
      if (namespaceBindings.size > 0) scanNamespaceBindingUse(node, namespaceBindings, edges, bindingNodes)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return edges
}
