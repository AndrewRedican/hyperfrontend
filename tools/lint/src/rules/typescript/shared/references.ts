/**
 * What rules ask of the scope analysis about a name: whether a scope reads it as a global the
 * program never declares.
 *
 * @module rules/typescript/shared/references
 */

import type { Node } from '../../../code/model.ts'
import type { ScopeAnalysis } from '../../../scope/analysis.ts'
import { scopeOf } from '../../../scope/analysis.ts'

/**
 * Whether a name, read from the scope a node sits in, refers to a global: the first reference
 * of that name the scope makes resolves to nothing, or to a variable without a declaration, as
 * the language's own globals are known.
 *
 * @param analysis - The program's scope analysis
 * @param node - The node whose scope is looked at
 * @param name - The name referenced
 * @returns Whether the reference reaches a global
 */
export function isReferenceToGlobal(analysis: ScopeAnalysis, node: Node, name: string): boolean {
  const ref = scopeOf(analysis, node).references.find((candidate) => candidate.identifier.name === name)
  return ref === undefined || ref.resolved === null || ref.resolved.defs.length === 0
}
