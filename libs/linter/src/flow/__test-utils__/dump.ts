/**
 * The control-flow analysis written out in one canonical form, path by path and segment by
 * segment, for the specs to compare.
 *
 * @module flow/__test-utils__/dump
 */

import type { Node } from '../../code/model.ts'
import type { FlowAnalysis } from '../model.ts'

/**
 * Writes an analysis out, one line per path and per segment.
 *
 * @param analysis - The analysis written out
 * @param cases - The switch cases whose end segments are listed
 * @returns The lines
 *
 * @example Writing out the flow of a one-line program
 * ```typescript
 * dumpFlow(analyzeFlow(parseCode('a\n', '.ts').tree as Node))
 * // => ['P Program@0 final=[0] thrown=[]', '  S0 live prevs=[] thrown=[] ExpressionStatement@0,Identifier@0']
 * ```
 */
export function dumpFlow(analysis: FlowAnalysis, cases: readonly Node[] = []): string[] {
  const lines: string[] = []
  for (const path of analysis.paths) {
    lines.push(
      `P ${path.root.kind}@${path.root.start} final=[${path.final.map((s) => s.id).join(',')}] thrown=[${path.thrown.map((s) => s.id).join(',')}]`
    )
    for (const segment of path.segments) {
      const nodes = segment.nodes.map((node) => `${node.kind}@${node.start}`).join(',')
      const prevs = segment.prevs.map((s) => s.id).join(',')
      const thrown = segment.thrownFrom.map((s) => s.id).join(',')
      lines.push(`  S${segment.id} ${segment.reachable ? 'live' : 'dead'} prevs=[${prevs}] thrown=[${thrown}] ${nodes}`)
    }
  }
  for (const switchCase of cases) {
    lines.push(
      `C ${switchCase.start} end=[${analysis
        .caseEnd(switchCase)
        .map((s) => s.id)
        .join(',')}]`
    )
  }
  return lines
}
