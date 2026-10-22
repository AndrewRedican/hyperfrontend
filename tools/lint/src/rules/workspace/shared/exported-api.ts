/**
 * The exported API of a module as the documentation rules read it: exported function and class
 * declarations, and exported variables initialised with a function, each with the JSDoc block
 * that directly precedes its export statement.
 *
 * @module rules/workspace/shared/exported-api
 */

import type { Node } from '../../../code/model.ts'
import type { SourceComment } from '../../../config/directives.ts'
import type { RuleContext } from '../../../engine/rule.ts'
import { tokenBefore } from '../../../code/source.ts'

/** One documented export. */
export interface ExportedApi {
  /** The node a problem is reported on. */
  readonly node: Node
  /** The JSDoc block before the export statement, or null. */
  readonly jsdoc: SourceComment | null
}

/**
 * Whether a node is an export statement.
 *
 * @param node - A statement, possibly absent
 * @returns Whether it exports what it holds
 */
function isExport(node: Node | null | undefined): node is Node {
  return node?.kind === 'ExportNamedDeclaration' || node?.kind === 'ExportDefaultDeclaration'
}

/**
 * The JSDoc block directly before a statement: the last comment between the previous token and
 * the statement, when it is a block opening with `/**`.
 *
 * @param context - The rule context
 * @param statement - A top-level declaration or export
 * @returns The block, or null
 */
function leadingJsdoc(context: RuleContext<unknown, Node>, statement: Node): SourceComment | null {
  const previous = tokenBefore(context.tree, statement.start)
  const from = previous === null ? 0 : previous.end
  const before = context.file.comments.filter((comment) => comment.start >= from && comment.end <= statement.start)
  const last = before[before.length - 1]
  return last !== undefined && context.file.text[last.start + 1] === '*' && last.text.startsWith('*') ? last : null
}

/**
 * The listeners collecting a module's exported API, calling back once per export.
 *
 * @param context - The rule context
 * @param found - What is done with each export
 * @returns What the rule runs on each exported function, class and variable
 */
export function exportedApiListeners(
  context: RuleContext<unknown, Node>,
  found: (api: ExportedApi) => void
): Record<string, (node: Node) => void> {
  const declaration = (node: Node): void => {
    if (isExport(node.parent)) found({ node, jsdoc: leadingJsdoc(context, node.parent) })
  }
  return {
    FunctionDeclaration: declaration,
    ClassDeclaration: declaration,
    VariableDeclaration(node) {
      const statement = node.parent
      if (statement?.kind !== 'ExportNamedDeclaration') return
      for (const declarator of node.declarations as readonly Node[]) {
        const init = declarator.init as Node | null
        if (init?.kind === 'ArrowFunctionExpression' || init?.kind === 'FunctionExpression')
          found({ node: declarator, jsdoc: leadingJsdoc(context, statement) })
      }
    },
  }
}

/**
 * Where a complete `@example` tag sits in a comment's text, in any case.
 *
 * @param text - The comment's text
 * @param from - Where to search from
 * @returns The offset of the tag, or -1
 */
export function exampleTagAt(text: string, from = 0): number {
  const lower = text.toLowerCase()
  for (let index = lower.indexOf('@example', from); index !== -1; index = lower.indexOf('@example', index + 1)) {
    const after = text[index + 8]
    if (after === undefined || after === ' ' || after === '\t' || after === '\n' || after === '\r') return index
  }
  return -1
}
