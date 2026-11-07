/**
 * The canonical order of the graph's edges and text, so two graphs built from the same inputs
 * serialise to the same bytes whatever order their edges were found in.
 *
 * @module graph/order
 */

import type { Edge, EdgeEvidence } from './model'

/**
 * Orders two edges deterministically: by source, target, kind, role, specifier, then evidence.
 *
 * @param left - One edge
 * @param right - Another
 * @returns Negative, zero or positive as a comparator does
 *
 * @example Checking that a list of edges is already canonical
 * ```typescript
 * const canonical = graph.records.every((edge, index) => index === 0 || compareEdges(graph.records[index - 1]!, edge) <= 0)
 * // => true
 * ```
 */
export function compareEdges(left: Edge, right: Edge): number {
  return (
    compareText(left.source, right.source) ||
    compareText(left.target, right.target) ||
    compareText(left.kind, right.kind) ||
    compareText(left.role, right.role) ||
    compareText(left.path?.specifier ?? '', right.path?.specifier ?? '') ||
    compareText(left.evidence.file, right.evidence.file) ||
    compareEvidencePosition(left.evidence, right.evidence)
  )
}

/**
 * Orders two pieces of evidence from the same file: a source position by line and column, a
 * configuration key by text; source evidence sorts before configuration evidence.
 *
 * @param left - One piece of evidence
 * @param right - Another
 * @returns Negative, zero or positive as a comparator does
 */
function compareEvidencePosition(left: EdgeEvidence, right: EdgeEvidence): number {
  if (left.kind === 'source' && right.kind === 'source') return left.line - right.line || left.column - right.column
  if (left.kind === 'configuration' && right.kind === 'configuration') return compareText(left.key, right.key)
  return left.kind === 'source' ? -1 : 1
}

/**
 * Orders two strings by code unit, the way every serialisation of the graph is ordered.
 *
 * @param left - One string
 * @param right - Another
 * @returns Negative, zero or positive as a comparator does
 *
 * @example Code-unit order, not locale order
 * ```typescript
 * ['b', 'B', 'a', 'A'].sort(compareText) // => ['A', 'B', 'a', 'b']
 * ['b', 'B', 'a', 'A'].sort((left, right) => left.localeCompare(right)) // => ['a', 'A', 'b', 'B']
 * ```
 */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * The edges in their canonical order, so two graphs built from the same inputs serialise to the
 * same bytes whatever order their edges were found in.
 *
 * @param edges - The edges in any order
 * @returns A sorted copy
 *
 * @example One order whatever order the edges arrived in
 * ```typescript
 * const forward = sortEdges(edges)
 * const backward = sortEdges([...edges].reverse())
 * JSON.stringify(forward) === JSON.stringify(backward) // => true
 * forward === edges // => false, the input is never sorted in place
 * ```
 */
export function sortEdges(edges: readonly Edge[]): Edge[] {
  return [...edges].sort(compareEdges)
}
