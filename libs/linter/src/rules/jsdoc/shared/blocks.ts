/**
 * Every JSDoc block of a file, each paired with the node it documents when one does: the rules
 * that check tags and types read every block, attached or not, and some ask what it documents.
 *
 * @module rules/jsdoc/shared/blocks
 */

import type { Node } from '../../../code/model'
import type { SourceComment } from '../../../config/directives'
import type { RuleContext } from '../../../engine/rule'
import type { JsdocBlock } from '../../../jsdoc/parse'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { childrenOf } from '../../../code/children'
import { commentBefore, DEFAULT_ATTACH, reducedNode } from '../../../jsdoc/attach'
import { parseJsdoc } from '../../../jsdoc/parse'

/** One block of a file. */
export interface FileBlock {
  /** The comment holding it. */
  readonly comment: SourceComment
  /** The parsed block. */
  readonly block: JsdocBlock
  /** The first node, in a walk from the program down, that the block documents, or null. */
  readonly node: Node | null
}

/** The blocks found so far, per program. */
const found = createWeakMap<Node, readonly FileBlock[]>()

/**
 * Whether a comment is a JSDoc block: a block comment opening with `/**` and whitespace.
 *
 * @param context - The rule's context
 * @param comment - The comment examined
 * @returns Whether the jsdoc rules read it
 */
function isJsdoc(context: RuleContext<unknown, Node>, comment: SourceComment): boolean {
  const { text } = context.file
  return text[comment.start + 1] === '*' && comment.text.length > 1 && comment.text[0] === '*' && /\s/.test(comment.text[1] as string)
}

/**
 * Pairs comments with the nodes they document, the first node in a walk from the program down
 * claiming a comment.
 *
 * @param context - The rule's context
 * @returns The node each claimed comment documents, by comment start
 */
function claims(context: RuleContext<unknown, Node>): Map<number, Node> {
  const { file, tree } = context
  const claimed = createMap<number, Node>()
  const visit = (node: Node): void => {
    const comment = commentBefore(file, tree, reducedNode(file, tree, node), DEFAULT_ATTACH)
    if (comment !== null && !claimed.has(comment.start)) claimed.set(comment.start, node)
    for (const child of childrenOf(node)) visit(child)
  }
  for (const child of childrenOf(tree)) visit(child)
  return claimed
}

/**
 * The JSDoc blocks of the file linted, in source order, parsed once per program.
 *
 * @param context - The rule's context
 * @returns The blocks with the nodes they document
 *
 * @example Visit every block, documenting or not
 * ```ts
 * // a documented export, then a block that documents nothing
 * fileBlocks(context).map(({ node }) => node?.kind ?? null)
 * // => ['ExportNamedDeclaration', null]
 * fileBlocks(context) === fileBlocks(context) // => true (parsed once)
 * ```
 */
export function fileBlocks(context: RuleContext<unknown, Node>): readonly FileBlock[] {
  const cached = found.get(context.tree)
  if (cached !== undefined) return cached
  const { file } = context
  const comments = file.comments.filter((comment) => isJsdoc(context, comment))
  const claimed = comments.length === 0 ? createMap<number, Node>() : claims(context)
  const blocks = comments.map((comment) => ({
    comment,
    block: parseJsdoc(file.text, comment.start, comment.end, file.lines.starts),
    node: claimed.get(comment.start) ?? null,
  }))
  found.set(context.tree, blocks)
  return blocks
}
