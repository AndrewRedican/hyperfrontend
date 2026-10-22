/**
 * The type expressions of a block's tags walked as the type rules read them: each tag with a
 * type that parses, and every node of its type with the node holding it and the field it sits in.
 *
 * @module rules/jsdoc/shared/type-walk
 */

import type { JsdocBlock, JsdocTag } from '../../../jsdoc/parse.ts'
import type { TypeNode } from '../../../jsdoc/types.ts'
import { parseType } from '../../../jsdoc/types.ts'

/** One node of a type with where it sits. */
export interface TypeVisit {
  /** The node. */
  readonly node: TypeNode
  /** The node holding it, or null for the root. */
  readonly parent: TypeNode | null
  /** The field of the parent it sits in, or null for the root. */
  readonly field: 'left' | 'right' | 'third' | 'fourth' | 'elements' | null
}

/** A tag with its parsed type. */
export interface TypedTag {
  /** The tag. */
  readonly tag: JsdocTag
  /** The root of its type. */
  readonly root: TypeNode
}

/**
 * Lists the nodes of a type, the root first, in document order, each with its parent and field.
 *
 * @param root - The root of the type walked
 * @returns Every node with its parent and field
 */
export function typeVisits(root: TypeNode): TypeVisit[] {
  const visits: TypeVisit[] = []
  const visit = (node: TypeNode, parent: TypeNode | null, field: TypeVisit['field']): void => {
    visits.push({ node, parent, field })
    for (const key of ['left', 'right', 'third', 'fourth'] as const) {
      const child = node[key]
      if (child !== undefined) visit(child, node, key)
    }
    for (const child of node.elements ?? []) visit(child, node, 'elements')
  }
  visit(root, null, null)
  return visits
}

/**
 * The tags of a block whose type parses; an `@import` tag's braces name bindings, not a type.
 *
 * @param block - The block whose tags are read
 * @returns The tags with their types
 */
export function typedTags(block: JsdocBlock): TypedTag[] {
  const typed: TypedTag[] = []
  for (const tag of block.tags) {
    if (tag.type === '' || tag.tag === 'import') continue
    const { node } = parseType(tag.type)
    if (node !== null) typed.push({ tag, root: node })
  }
  return typed
}

/**
 * Whether a visited node is a name the type rules check: a plain name, but not a member named
 * after a path's dot.
 *
 * @param visit - The visited node tested
 * @returns Whether it is a checked name
 */
export function isCheckedName(visit: TypeVisit): boolean {
  return visit.node.kind === 'name' && !(visit.parent?.kind === 'namePath' && visit.field === 'right')
}
