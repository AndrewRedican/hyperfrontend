/**
 * A test that always holds, or never does, is a leftover of debugging or a mistake. `while
 * (true)` alone is the idiom for a loop that ends by `break` and passes; a loop a generator
 * yields from passes too, as the yield is what ends it.
 *
 * @module rules/javascript/no-constant-condition
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'
import { isConstant } from './shared/constant'

/** The rule's options; the workspace runs the rule in its default mode, the only one implemented. */
export interface NoConstantConditionOptions {
  /** Which loops are checked; only `allExceptWhileTrue`, the default, is implemented: every loop but `while (true)`. */
  readonly checkLoops?: 'allExceptWhileTrue'
}

export default defineRule<NoConstantConditionOptions | undefined, Node>({
  id: 'no-constant-condition',
  language: 'code',
  fixable: false,
  create(context) {
    const stack: Set<Node>[] = []
    let loops = createSet<Node>()
    const isConstantTest = (node: Node): boolean => {
      const test = node.test as Node | null
      return test !== null && isConstant(scopeAnalysisOf(context), test, true)
    }
    const report = (node: Node): void => {
      const test = node.test as Node
      context.report({ start: test.start, end: test.end, message: 'Unexpected constant condition.' })
    }
    const check = (node: Node): void => {
      if (isConstantTest(node)) report(node)
    }
    const track = (node: Node): void => {
      if (isConstantTest(node)) loops.add(node)
    }
    const settle = (node: Node): void => {
      if (loops.delete(node)) report(node)
    }
    const enter = (): void => {
      stack.push(loops)
      loops = createSet<Node>()
    }
    const exit = (): void => {
      loops = stack.pop() as Set<Node>
    }
    return {
      ConditionalExpression: check,
      IfStatement: check,
      WhileStatement(node) {
        const test = node.test as Node
        if (test.kind === 'Literal' && test.value === true) return
        track(node)
      },
      'WhileStatement:exit': settle,
      DoWhileStatement: track,
      'DoWhileStatement:exit': settle,
      ForStatement: track,
      'ForStatement:exit': settle,
      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': exit,
      FunctionExpression: enter,
      'FunctionExpression:exit': exit,
      YieldExpression(node) {
        // why: a yield in the initialiser of a `for` runs before the loop does; that loop keeps its report.
        for (const loop of loops) {
          const init = loop.init as Node | null | undefined
          if (init === null || init === undefined || node.start < init.start || node.end > init.end) loops.delete(loop)
        }
      },
    }
  },
})
