import type { TreeNode } from './traverse.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { groupListeners, traverse } from './traverse.ts'

interface Node extends TreeNode {
  readonly name: string
  readonly children?: readonly Node[]
}

const TREE: Node = {
  kind: 'root',
  name: 'r',
  children: [
    { kind: 'leaf', name: 'a' },
    { kind: 'branch', name: 'b', children: [{ kind: 'leaf', name: 'c' }] },
  ],
}

const children = (node: Node): readonly Node[] => node.children ?? []

describe('groupListeners', () => {
  it('merges the listeners of every rule by kind', () => {
    const first = (): void => undefined
    const second = (): void => undefined
    expect([...groupListeners<Node>([{ leaf: first }, { leaf: second, root: first }])]).toEqual([
      ['leaf', [first, second]],
      ['root', [first]],
    ])
  })
})

describe('traverse', () => {
  it('visits nodes depth first, entering before exiting', () => {
    const visited: string[] = []
    const grouped = groupListeners<Node>([
      { leaf: (node) => visited.push(`enter ${node.name}`), branch: (node) => visited.push(`enter ${node.name}`) },
      { 'branch:exit': (node) => visited.push(`exit ${node.name}`) },
    ])
    traverse(TREE, children, grouped)
    expect(visited).toEqual(['enter a', 'enter b', 'enter c', 'exit b'])
  })

  it('hands each listener the ancestors of the node', () => {
    const seen: string[][] = []
    traverse(TREE, children, groupListeners<Node>([{ leaf: (_node, parents) => seen.push(parents.map((parent) => parent.name)) }]))
    expect(seen).toEqual([['r'], ['r', 'b']])
  })
})
