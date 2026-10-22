/**
 * What the ordering rules share: whether a set of top-level statements sits in one unbroken
 * run, the fix that rewrites that run in a new order, and the check that reports a run of
 * imports or re-exports out of the order the workspace wants.
 *
 * @module rules/workspace/shared/ordering
 */

import type { Node } from '../../../code/model.ts'
import type { Fix } from '../../../engine/report.ts'
import type { RuleContext, RuleFile } from '../../../engine/rule.ts'
import { compareModuleStatements } from './sources.ts'

/**
 * Whether statements follow one another in a body with nothing between them.
 *
 * @param body - The statements of the program
 * @param statements - Some of them, in source order
 * @returns True when no other statement sits between the first and the last
 */
export function isContiguous(body: readonly Node[], statements: readonly Node[]): boolean {
  const first = body.indexOf(statements[0] as Node)
  const last = body.indexOf(statements[statements.length - 1] as Node)
  return last - first + 1 === statements.length
}

/**
 * The fix that rewrites a run of statements in another order, one per line.
 *
 * @param file - The file linted
 * @param statements - The run, in source order
 * @param ordered - The same statements in the order wanted
 * @returns The replacement of the span from the first statement to the last
 */
export function rewriteRun(file: RuleFile, statements: readonly Node[], ordered: readonly Node[]): Fix {
  const first = statements[0] as Node
  const last = statements[statements.length - 1] as Node
  return { start: first.start, end: last.end, text: ordered.map((statement) => file.text.slice(statement.start, statement.end)).join('\n') }
}

/**
 * Reports the first of some import or re-export statements when they are out of order, with a
 * fix when nothing else sits among them.
 *
 * @param context - The rule's context
 * @param body - The statements of the program
 * @param statements - The imports or re-exports among them, in source order
 * @param message - What to report
 */
export function checkModuleOrder(
  context: RuleContext<unknown, Node>,
  body: readonly Node[],
  statements: readonly Node[],
  message: string
): void {
  if (statements.length <= 1) return
  const ordered = [...statements].sort(compareModuleStatements)
  if (ordered.every((statement, index) => statement === statements[index])) return
  const first = statements[0] as Node
  context.report({
    start: first.start,
    end: first.end,
    message,
    fix: isContiguous(body, statements) ? rewriteRun(context.file, statements, ordered) : undefined,
  })
}
