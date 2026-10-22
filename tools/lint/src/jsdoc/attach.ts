/**
 * Which JSDoc block documents a node: the block comment that precedes the node, or the
 * declaration, property or export the node sits in, within a line of it, as the previous linter
 * attached them.
 *
 * @module jsdoc/attach
 */

import type { Node } from '../code/model.ts'
import type { SourceComment } from '../config/directives.ts'
import type { RuleContext, RuleFile } from '../engine/rule.ts'
import type { JsdocBlock } from './parse.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { commentsBetween, tokenBefore } from '../code/source.ts'
import { positionAt } from '../text/lines.ts'
import { parseJsdoc } from './parse.ts'

/** The declarations whose comment sits before the export wrapping them, when one does. */
const DECLARATIONS = createSet<string>([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSEnumDeclaration',
  'ClassDeclaration',
  'FunctionDeclaration',
])

/** The expressions whose comment may sit before the statement or property holding them. */
const EXPRESSIONS = createSet<string>([
  'TSDeclareFunction',
  'ClassExpression',
  'ObjectExpression',
  'ArrowFunctionExpression',
  'TSEmptyBodyFunctionExpression',
  'FunctionExpression',
])

/** The parents an expression's search for a comment stops at, the comment before them counting. */
const HOLDERS = createSet<string>([
  'AssignmentPattern',
  'VariableDeclaration',
  'ExpressionStatement',
  'MethodDefinition',
  'Property',
  'PropertyDefinition',
  'ExportDefaultDeclaration',
  'ReturnStatement',
])

/** The parents that invoke an expression, before which a comment documents the call, not the expression. */
const INVOCATIONS = createSet<string>(['CallExpression', 'NewExpression'])

/** How far a block may sit from the node it documents. */
export interface AttachSettings {
  /** The least number of lines between the block's end and the node. */
  readonly minLines: number
  /** The most number of lines between the block's end and the node. */
  readonly maxLines: number
}

/** The default distance: the block ends on the line before the node, or on the node's line. */
export const DEFAULT_ATTACH: AttachSettings = { minLines: 0, maxLines: 1 }

/**
 * Whether a parent is an export wrapping a declaration.
 *
 * @param parent - The parent examined
 * @returns Whether a comment before it documents the declaration
 */
function isExport(parent: Node): boolean {
  return parent.kind === 'ExportNamedDeclaration' || parent.kind === 'ExportDefaultDeclaration'
}

/**
 * Whether a comment sits directly before a node.
 *
 * @param file - The file linted
 * @param tree - The program
 * @param node - The node looked before
 * @returns Whether comments lie between the previous token and the node
 */
function hasCommentsBefore(file: RuleFile, tree: Node, node: Node): boolean {
  const previous = tokenBefore(tree, node.start)
  return commentsBetween(file, previous === null ? 0 : previous.end, node.start).length > 0
}

/**
 * The node whose preceding comment documents a node: a declaration's export, an expression's
 * declaration, property or statement.
 *
 * @param file - The file linted
 * @param tree - The program
 * @param node - The node documented
 * @returns The node to look before
 */
export function reducedNode(file: RuleFile, tree: Node, node: Node): Node {
  let parent = node.parent as Node
  if (DECLARATIONS.has(node.kind)) return isExport(parent) ? parent : node
  if (!EXPRESSIONS.has(node.kind) || INVOCATIONS.has(parent.kind)) return node
  let token = tokenBefore(tree, node.start)
  while (token !== null && file.text[token.start] === '(') token = tokenBefore(tree, token.start)
  // why: a comment right before the expression, parentheses aside, documents the expression itself.
  if (token !== null && commentsBetween(file, token.end, node.start).some((comment) => file.text[comment.start + 1] === '*')) return node
  if (hasCommentsBefore(file, tree, parent)) return parent
  while (!hasCommentsBefore(file, tree, parent) && !parent.kind.includes('Function') && !HOLDERS.has(parent.kind)) {
    if (parent.parent === null) return node
    parent = parent.parent
  }
  if (parent.kind === 'FunctionDeclaration' || parent.kind === 'Program') return node
  const grandparent = parent.parent as Node
  return grandparent.kind === 'ExportNamedDeclaration' ? grandparent : parent
}

/**
 * The first decorator before a node, its declaration or its parent, which a comment precedes.
 *
 * @param node - The node decorated
 * @returns The decorator, or null
 */
function firstDecorator(node: Node): Node | null {
  const declaration = node.declaration as Node | null | undefined
  const own = (declaration?.decorators ?? node.decorators ?? (node.parent as Node | null)?.decorators) as readonly Node[] | undefined
  return own?.[0] ?? null
}

/**
 * The JSDoc comment before a node, within the configured distance.
 *
 * @param file - The file linted
 * @param tree - The program
 * @param node - The node to look before
 * @param settings - How far the comment may sit
 * @returns The comment, or null
 */
export function commentBefore(file: RuleFile, tree: Node, node: Node, settings: AttachSettings): SourceComment | null {
  let current: Node | SourceComment = node
  let candidate: SourceComment | null
  let parenthesis: number | null = null
  for (;;) {
    const decorator = 'kind' in current ? firstDecorator(current) : null
    if (decorator !== null) current = decorator
    let token = tokenBefore(tree, current.start)
    let beforeComments = commentsBetween(file, token === null ? 0 : token.end, current.start)
    if (token !== null && beforeComments.length === 0 && file.text[token.start] === '(') {
      parenthesis = token.end
      token = tokenBefore(tree, token.start)
      beforeComments = commentsBetween(file, token === null ? 0 : token.end, parenthesis - 1)
    }
    candidate = beforeComments[beforeComments.length - 1] ?? null
    if (candidate === null) return null
    // why: a line comment between the block and the node does not break the attachment.
    if (file.text[candidate.start + 1] === '/') {
      current = candidate
      parenthesis = null
      continue
    }
    break
  }
  if (!/^\*\s/.test(candidate.text) && !candidate.text.startsWith('*\n')) return null
  const endLine = positionAt(file.lines, parenthesis ?? candidate.end).line
  const gap = positionAt(file.lines, current.start).line - endLine
  return gap >= settings.minLines && gap <= settings.maxLines ? candidate : null
}

/** The blocks parsed so far, by comment start, per program. */
const parsed = createWeakMap<Node, Map<number, JsdocBlock>>()

/**
 * The JSDoc block documenting a node, parsed once per comment.
 *
 * @param context - The rule's context
 * @param node - The node documented
 * @param settings - How far the comment may sit; the default distance unless given
 * @returns The block, or null when none documents the node
 */
export function jsdocOf(context: RuleContext<unknown, Node>, node: Node, settings: AttachSettings = DEFAULT_ATTACH): JsdocBlock | null {
  const comment = commentBefore(context.file, context.tree, reducedNode(context.file, context.tree, node), settings)
  if (comment === null) return null
  let blocks = parsed.get(context.tree)
  if (blocks === undefined) {
    blocks = createMap<number, JsdocBlock>()
    parsed.set(context.tree, blocks)
  }
  let block = blocks.get(comment.start)
  if (block === undefined) {
    block = parseJsdoc(context.file.text, comment.start, comment.end, context.file.lines.starts)
    blocks.set(comment.start, block)
  }
  return block
}
