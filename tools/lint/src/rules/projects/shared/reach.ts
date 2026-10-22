/**
 * Walks over the project graph the boundary rule needs: the path a cycle takes, whether a project
 * reaches another through dynamic imports alone, and the files that draw each step.
 *
 * @module rules/projects/shared/reach
 */

import type { WorkspaceGraph } from '../../../graph/build.ts'
import type { Edge, ProjectRecord } from '../../../graph/model.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'

/** What one graph's walks share: each project's direct dependencies and the projects it reaches. */
interface Reach {
  /** The projects each depends on directly, one entry per edge, in edge order. */
  readonly next: ReadonlyMap<string, readonly string[]>
  /** The projects each reaches, itself included. */
  readonly reached: ReadonlyMap<string, ReadonlySet<string>>
}

/** The walks computed so far, by graph. */
const reaches = createWeakMap<WorkspaceGraph, Reach>()

/**
 * The direct dependencies and reachable sets of a graph, computed once.
 *
 * @param graph - The workspace graph
 * @returns The walks' shared data
 */
function reachOf(graph: WorkspaceGraph): Reach {
  const known = reaches.get(graph)
  if (known !== undefined) return known
  const next = createMap<string, readonly string[]>()
  for (const name of graph.projects.keys()) {
    next.set(
      name,
      (graph.edges.get(name) as readonly Edge[]).map((edge) => edge.target).filter((target) => graph.projects.has(target))
    )
  }
  const reached = createMap<string, ReadonlySet<string>>()
  for (const name of graph.projects.keys()) {
    const seen = createSet<string>()
    const visit = (current: string): void => {
      seen.add(current)
      for (const adjacent of next.get(current) as readonly string[]) if (!seen.has(adjacent)) visit(adjacent)
    }
    visit(name)
    reached.set(name, seen)
  }
  const reach = { next, reached }
  reaches.set(graph, reach)
  return reach
}

/**
 * The path from one project to another along the graph's edges, as the previous rule walked it:
 * depth first, the last-pushed neighbour taken first, only through projects that reach the end.
 *
 * @param graph - The workspace graph
 * @param from - The project the path starts at
 * @param to - The project the path ends at
 * @returns The project names along the path, both ends included, or none when there is no path or the ends are one project
 */
export function pathBetween(graph: WorkspaceGraph, from: string, to: string): string[] {
  const { next, reached } = reachOf(graph)
  let path: string[] = []
  const stack: [string, string[]][] = [[from, path]]
  const visited = [from]
  while (stack.length > 0) {
    const [current, before] = stack.pop() as [string, string[]]
    path = [...before, current]
    if (current === to) break
    for (const adjacent of next.get(current) as readonly string[]) {
      if (visited.includes(adjacent) || !(reached.get(adjacent) as ReadonlySet<string>).has(to)) continue
      visited.push(adjacent)
      stack.push([adjacent, [...path]])
    }
  }
  return path.length > 1 ? path : []
}

/**
 * Whether a project reaches another through a chain of dynamic imports.
 *
 * @param graph - The workspace graph
 * @param from - The importing project
 * @param to - The project looked for
 * @param visited - The projects already on the chain
 * @returns Whether such a chain exists
 */
export function reachesDynamically(graph: WorkspaceGraph, from: string, to: string, visited: readonly string[] = []): boolean {
  if (visited.includes(from)) return false
  return (graph.edges.get(from) as readonly Edge[]).some(
    (edge) => edge.type === 'dynamic' && (edge.target === to || reachesDynamically(graph, edge.target, to, [...visited, from]))
  )
}

/**
 * The files of a project that import another, in the project's file order.
 *
 * @param graph - The workspace graph
 * @param from - The importing project
 * @param to - The imported project
 * @param dynamicOnly - Whether only dynamic imports count
 * @returns The workspace-relative paths
 */
export function filesImporting(graph: WorkspaceGraph, from: string, to: string, dynamicOnly: boolean): string[] {
  const drawing = createSet<string>()
  for (const edge of graph.edges.get(from) as readonly Edge[]) {
    if (edge.target === to && (!dynamicOnly || edge.type === 'dynamic')) for (const file of edge.files) drawing.add(file)
  }
  return (graph.projects.get(from) as ProjectRecord).files.filter((file) => drawing.has(file))
}
