/**
 * What rules ask of the scope analysis about a name: whether a scope reads it as a global the
 * program never declares.
 *
 * @module rules/typescript/shared/references
 */

import type { Node } from '../../../code/model'
import type { ScopeAnalysis } from '../../../scope/analysis'
import { scopeOf } from '../../../scope/analysis'

/**
 * Whether a name, read from the scope a node sits in, refers to a global: the first reference
 * of that name the scope makes resolves to nothing, or to a variable without a declaration, as
 * the language's own globals are known.
 *
 * @param analysis - The program's scope analysis
 * @param node - The node whose scope is looked at
 * @param name - The name referenced
 * @returns Whether the reference reaches a global
 *
 * @example Tell the global Promise from a parameter named Promise
 * ```ts
 * // function load() { return Promise.resolve(1) }
 * isReferenceToGlobal(analysis, returnInLoad, 'Promise') // => true
 * // function wrap(Promise) { return Promise.resolve(1) }
 * isReferenceToGlobal(analysis, returnInWrap, 'Promise') // => false
 * ```
 */
export function isReferenceToGlobal(analysis: ScopeAnalysis, node: Node, name: string): boolean {
  const ref = scopeOf(analysis, node).references.find((candidate) => candidate.identifier.name === name)
  return ref === undefined || ref.resolved === null || ref.resolved.defs.length === 0
}
