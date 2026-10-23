/**
 * What the ordering rules share: whether a set of top-level statements sits in one unbroken
 * run, the fix that rewrites that run in a new order, and the check that reports a run of
 * imports or re-exports out of the order the workspace wants.
 *
 * @module rules/conventions/shared/ordering
 */

import type { Node } from '../../../code/model'
import type { Fix } from '../../../engine/report'
import type { RuleContext, RuleFile } from '../../../engine/rule'
import { compareModuleStatements } from './sources'

/**
 * Whether statements follow one another in a body with nothing between them.
 *
 * @param body - The statements of the program
 * @param statements - Some of them, in source order
 * @returns True when no other statement sits between the first and the last
 *
 * @example A statement between two imports breaks the run
 * ```ts
 * // program: import a from 'a' / const x = 1 / import b from 'b'
 * const imports = program.body.filter((node) => node.kind === 'ImportDeclaration')
 * isContiguous(program.body, imports) // => false
 * isContiguous(program.body, imports.slice(0, 1)) // => true
 * ```
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
 *
 * @example Swap two adjacent imports
 * ```ts
 * // file.text: "import { b } from './b'\nimport fs from 'node:fs'"
 * const [local, builtin] = program.body
 * rewriteRun(file, [local, builtin], [builtin, local])
 * // => { start: 0, end: 48,
 * //      text: "import fs from 'node:fs'\nimport { b } from './b'" }
 * ```
 */
export function rewriteRun(file: RuleFile, statements: readonly Node[], ordered: readonly Node[]): Fix {
  const first = statements[0] as Node
  const last = statements[statements.length - 1] as Node
  return { start: first.start, end: last.end, text: ordered.map((statement) => file.text.slice(statement.start, statement.end)).join('\n') }
}

/** The options of `import-order` and `export-order`. */
export interface OrderOptions {
  /** Package scopes, such as `@acme`, whose packages form a group of their own after the external packages. */
  readonly internalScopes?: readonly string[]
}

/**
 * What an ordering rule reports, naming the groups in order.
 *
 * @param noun - `Imports` or `Exports`
 * @param internalScopes - The scopes grouped after the external packages
 * @returns The sentence that names the expected group order
 */
function orderMessage(noun: 'Imports' | 'Exports', internalScopes: readonly string[]): string {
  const groups = ['node:', 'external', ...internalScopes, 'relative by depth', 'current directory'].join(' → ')
  return `${noun} are not in the correct order. Expected order: type ${noun.toLowerCase()} first, then by source category (${groups}).`
}

/**
 * Reports the first of some import or re-export statements when they are out of order, with a
 * fix when nothing else sits among them.
 *
 * @param context - The rule's context
 * @param body - The statements of the program
 * @param statements - The imports or re-exports among them, in source order
 * @param noun - `Imports` or `Exports`, for the message
 *
 * @example Check a program's imports from a rule listener
 * ```ts
 * Program(program) {
 *   const imports = program.body.filter((node) => node.kind === 'ImportDeclaration')
 *   checkModuleOrder(context, program.body, imports, 'Imports')
 * }
 * // "import { b } from './b'\nimport fs from 'node:fs'" reports at the
 * // first import, with a fix that moves 'node:fs' above './b'
 * ```
 */
export function checkModuleOrder(
  context: RuleContext<OrderOptions | undefined, Node>,
  body: readonly Node[],
  statements: readonly Node[],
  noun: 'Imports' | 'Exports'
): void {
  if (statements.length <= 1) return
  const internalScopes = context.options?.internalScopes ?? []
  const message = orderMessage(noun, internalScopes)
  const ordered = [...statements].sort((a, b) => compareModuleStatements(a, b, internalScopes))
  if (ordered.every((statement, index) => statement === statements[index])) return
  const first = statements[0] as Node
  context.report({
    start: first.start,
    end: first.end,
    message,
    fix: isContiguous(body, statements) ? rewriteRun(context.file, statements, ordered) : undefined,
  })
}
