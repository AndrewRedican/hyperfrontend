/**
 * The control-flow analysis a rule asks for: built once per program and shared by every rule
 * linting it.
 *
 * @module flow/analysis
 */

import type { Node } from '../code/model.ts'
import type { RuleContext } from '../engine/rule.ts'
import type { FlowAnalysis } from './model.ts'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { Builder } from './builder.ts'

/** The analyses built so far, by program. */
const analyses = createWeakMap<Node, FlowAnalysis>()

/**
 * Analyses a program's control flow.
 *
 * @param program - The program's tree
 * @returns The analysis
 */
export function analyzeFlow(program: Node): FlowAnalysis {
  return new Builder(program).analysis()
}

/**
 * The control-flow analysis of the program a rule is linting, built on first request.
 *
 * @param context - The rule's context
 * @returns The analysis, the same object on every request for the program
 */
export function flowAnalysisOf(context: RuleContext<unknown, Node>): FlowAnalysis {
  let analysis = analyses.get(context.tree)
  if (analysis === undefined) {
    analysis = analyzeFlow(context.tree)
    analyses.set(context.tree, analysis)
  }
  return analysis
}
