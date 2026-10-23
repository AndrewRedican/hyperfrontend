/**
 * A value assigned to a variable that nothing reads before the next assignment, or before the
 * function ends, was assigned for nothing.
 *
 * @module rules/javascript/no-useless-assignment
 */

import type { Node } from '../../code/model'
import type { CodePath, FlowAnalysis, Segment } from '../../flow/model'
import type { ScopeAnalysis } from '../../scope/analysis'
import type { Reference, Scope, Variable } from '../../scope/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { flowAnalysisOf } from '../../flow/analysis'
import { scopeAnalysisOf } from '../../scope/analysis'

/** The analyses a check reads. */
interface Analyses {
  /** The scopes. */
  readonly scopes: ScopeAnalysis
  /** The control flow. */
  readonly flow: FlowAnalysis
  /** The reference each identifier makes. */
  readonly references: ReadonlyMap<Node, Reference>
  /** The code path rooted at each node that roots one. */
  readonly pathsByRoot: ReadonlyMap<Node, CodePath>
}

/** The kinds of node whose body is a function of its own. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'StaticBlock'])

/** The loops that write their head each iteration. */
const LOOPS = createSet<string>(['ForInStatement', 'ForOfStatement'])

/** The kinds of node that export what they declare or name. */
const EXPORTS = createSet<string>(['ExportNamedDeclaration', 'ExportDefaultDeclaration', 'ExportSpecifier', 'TSExportAssignment'])

export default defineRule<undefined, Node>({
  id: 'no-useless-assignment',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      'Program:exit'() {
        const scopes = scopeAnalysisOf(context)
        const flow = flowAnalysisOf(context)
        const references = createMap<Node, Reference>()
        for (const scope of scopes.scopes) for (const ref of scope.references) references.set(ref.identifier, ref)
        const pathsByRoot = createMap(flow.paths.map((path) => [path.root, path] as const))
        const analyses: Analyses = { scopes, flow, references, pathsByRoot }
        for (const scope of scopes.scopes) {
          for (const variable of scope.variables) {
            for (const write of uselessWrites(analyses, variable)) {
              context.report({ start: write.start, end: write.end, message: 'This assigned value is not used in subsequent statements.' })
            }
          }
        }
      },
    }
  },
})

/**
 * The identifiers of a variable's writes whose value nothing reads.
 *
 * @param analyses - The scopes and the control flow
 * @param variable - The variable examined
 * @returns The identifiers, in source order
 */
function uselessWrites(analyses: Analyses, variable: Variable): Node[] {
  if (variable.defs.length === 0 || isExported(variable)) return []
  const home = homePath(analyses, variable.scope)
  const reads = variable.references.filter((ref) => ref.isRead())
  if (reads.length === 0) return []
  // why: a read from another function, or from a position the flow does not place, may happen at any time.
  if (reads.some((ref) => pathOf(analyses, ref.identifier) !== home)) return []
  const useless: Node[] = []
  for (const ref of variable.references) {
    if (!ref.isWrite() || pathOf(analyses, ref.identifier) !== home || useless.includes(ref.identifier)) continue
    const segment = analyses.flow.segmentOf(ref.identifier) as Segment
    // why: a write that never runs, one a loop head makes each iteration, and one inside a try block, which may be cut short at any point, are left alone.
    if (!segment.reachable || isLoopHead(ref) || isInTryBlock(ref.identifier)) continue
    if (!isUsedAfter(analyses, variable, segment, segment.nodes.indexOf(ref.identifier) + 1)) useless.push(ref.identifier)
  }
  return useless
}

/**
 * Whether a variable is read after a point: in the rest of the segment, or in any segment
 * control may reach from it, before another write.
 *
 * @param analyses - The scopes and the control flow
 * @param variable - The variable examined
 * @param start - The segment the point is in
 * @param index - The index in the segment's nodes to start from
 * @returns Whether a read comes first on some path
 */
function isUsedAfter(analyses: Analyses, variable: Variable, start: Segment, index: number): boolean {
  const rest = outcome(analyses, variable, start, index)
  if (rest === 'read') return true
  // why: an exception may leave a segment at any point, so a catch stays reachable past a write that would otherwise end the path.
  const queue = [...(rest === 'none' ? start.nexts : []), ...start.thrownTo]
  const visited = createSet<Segment>()
  while (queue.length > 0) {
    const segment = queue.shift() as Segment
    if (visited.has(segment)) continue
    visited.add(segment)
    const result = outcome(analyses, variable, segment, 0)
    if (result === 'read') return true
    queue.push(...(result === 'none' ? segment.nexts : []), ...segment.thrownTo)
  }
  return false
}

/**
 * What the first reference to a variable in a segment, from an index on, does.
 *
 * @param analyses - The scopes and the control flow
 * @param variable - The variable examined
 * @param segment - The segment scanned
 * @param index - The index to start from
 * @returns `read` for a read, `write` for a write alone, `none` when nothing refers to it
 */
function outcome(analyses: Analyses, variable: Variable, segment: Segment, index: number): string {
  for (let at = index; at < segment.nodes.length; at += 1) {
    const ref = analyses.references.get(segment.nodes[at] as Node)
    if (ref === undefined || ref.resolved !== variable) continue
    return ref.isRead() ? 'read' : 'write'
  }
  return 'none'
}

/**
 * The code path a reference is evaluated in, or null for one the flow does not place.
 *
 * @param analyses - The scopes and the control flow
 * @param identifier - The node making the reference
 * @returns The path the identifier lies on
 */
function pathOf(analyses: Analyses, identifier: Node): CodePath | null {
  // why: a JSX name is not an identifier the previous linter placed on a path.
  const segment = identifier.kind === 'JSXIdentifier' ? undefined : analyses.flow.segmentOf(identifier)
  return segment === undefined ? null : analyses.flow.pathOf(segment)
}

/**
 * The code path a scope's declarations belong to: the one rooted at the nearest enclosing
 * function, static block or field initialiser, or the program's.
 *
 * @param analyses - The scopes and the control flow
 * @param scope - Where the variable is declared
 * @returns The path the scope lies on
 */
function homePath(analyses: Analyses, scope: Scope): CodePath {
  // why: the walk ends at the global scope at the latest, whose block is the program, the root of the first path.
  return analyses.pathsByRoot.get(scope.block) ?? homePath(analyses, scope.upper as Scope)
}

/**
 * Whether a variable is exported: declared under an export, or named by one.
 *
 * @param variable - The variable examined
 * @returns Whether a module may read it
 */
function isExported(variable: Variable): boolean {
  const named = variable.references.some((ref) => EXPORTS.has((ref.identifier.parent as Node).kind))
  return named || variable.defs.some((def) => isUnderExport(def.node))
}

/**
 * Whether a declaring node sits under an export declaration.
 *
 * @param node - The declaring node
 * @returns Whether an export declares it
 */
function isUnderExport(node: Node): boolean {
  if (EXPORTS.has(node.kind)) return true
  // why: the walk ends at the program at the latest.
  if (node.kind === 'Program' || node.kind === 'BlockStatement') return false
  return isUnderExport(node.parent as Node)
}

/**
 * Whether a write is one a for-in or for-of loop makes each iteration: its value is the loop's
 * iterated expression.
 *
 * @param ref - The write reference
 * @returns Whether it sits in a loop head
 */
function isLoopHead(ref: Reference): boolean {
  return ref.writeExpr !== null && LOOPS.has((ref.writeExpr.parent as Node).kind)
}

/**
 * Whether an identifier sits inside the block of a try statement of its own function.
 *
 * @param identifier - The written identifier
 * @returns Whether an exception may cut the block short around it
 */
function isInTryBlock(identifier: Node): boolean {
  for (let current: Node | null = identifier; current.parent !== null; current = current.parent) {
    const parent = current.parent as Node
    if (parent.kind === 'TryStatement' && parent.block === current) return true
    if (FUNCTIONS.has(parent.kind)) return false
  }
  return false
}
