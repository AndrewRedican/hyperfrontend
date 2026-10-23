/**
 * The control-flow analysis a rule asks for: built once per program and shared by every rule
 * linting it.
 *
 * @module flow/analysis
 */

import type { Node } from '../code/model'
import type { RuleContext } from '../engine/rule'
import type { FlowAnalysis } from './model'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { Builder } from './builder'

/** The analyses built so far, by program. */
const analyses = createWeakMap<Node, FlowAnalysis>()

/**
 * Analyses a program's control flow.
 *
 * @param program - The program's tree
 * @returns The analysis
 *
 * @example Find code after a return
 * ```ts
 * const text = 'function check(ready) {\n  return ready\n  cleanup()\n}'
 * const program = parseCode(text, '.ts').tree
 * const flow = analyzeFlow(program)
 * flow.paths.map((path) => path.root.kind)
 * // => ['Program', 'FunctionDeclaration']
 * const cleanup = program.body[0].body.body[1].expression
 * flow.segmentOf(cleanup).reachable // => false
 * ```
 */
export function analyzeFlow(program: Node): FlowAnalysis {
  return new Builder(program).analysis()
}

/**
 * The control-flow analysis of the program a rule is linting, built on first request.
 *
 * @param context - The rule's context
 * @returns The analysis, the same object on every request for the program
 *
 * @example Share one analysis across a rule's handlers
 * ```ts
 * const flow = flowAnalysisOf(context)
 * flowAnalysisOf(context) === flow // => true, built once per program
 * ```
 */
export function flowAnalysisOf(context: RuleContext<unknown, Node>): FlowAnalysis {
  let analysis = analyses.get(context.tree)
  if (analysis === undefined) {
    analysis = analyzeFlow(context.tree)
    analyses.set(context.tree, analysis)
  }
  return analysis
}
