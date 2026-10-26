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
 */
export function sortEdges(edges: readonly Edge[]): Edge[] {
  return [...edges].sort(compareEdges)
}
