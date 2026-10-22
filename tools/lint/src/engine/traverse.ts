/**
 * One pass over a tree that calls every listener registered for a node's kind, on the way in
 * and, under `kind:exit`, on the way out. Languages describe their trees with a `children`
 * function; rules never walk.
 *
 * @module engine/traverse
 */

import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/** The least a tree node carries. */
export interface TreeNode {
  /** The node's kind, which selects listeners. */
  readonly kind: string
}

/** What a listener receives. */
export type Listener<Node extends TreeNode> = (node: Node, parents: readonly Node[]) => void

/** Listeners by kind, `kind:exit` for the way out. */
export type Listeners<Node extends TreeNode> = Readonly<Record<string, Listener<Node>>>

/**
 * Groups listeners by the kind they answer, so one lookup per node finds all of them.
 *
 * @param all - The listener tables of every rule
 * @returns Listeners by kind
 */
export function groupListeners<Node extends TreeNode>(all: readonly Listeners<Node>[]): Map<string, Listener<Node>[]> {
  const grouped = createMap<string, Listener<Node>[]>()
  for (const listeners of all) {
    for (const kind in listeners) {
      const list = grouped.get(kind)
      if (list === undefined) grouped.set(kind, [listeners[kind]])
      else list.push(listeners[kind])
    }
  }
  return grouped
}

/**
 * Walks a tree depth first.
 *
 * @param root - The root node
 * @param children - The children of a node, in source order
 * @param grouped - Listeners by kind, as `groupListeners` returns them
 */
export function traverse<Node extends TreeNode>(
  root: Node,
  children: (node: Node) => readonly Node[],
  grouped: ReadonlyMap<string, readonly Listener<Node>[]>
): void {
  const parents: Node[] = []
  const visit = (node: Node): void => {
    for (const listener of grouped.get(node.kind) ?? []) listener(node, parents)
    parents.push(node)
    for (const child of children(node)) visit(child)
    parents.pop()
    for (const listener of grouped.get(`${node.kind}:exit`) ?? []) listener(node, parents)
  }
  visit(root)
}
