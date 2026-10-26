/**
 * The order the scheduler serves chains in when more tasks are ready than the budgets allow:
 * libraries with a build first, the deepest in the dependency graph before the shallowest, then
 * the other libraries and tools, then the applications and demos.
 *
 * @module pipeline/order
 */

import type { WorkspaceGraph } from '../graph/build'
import type { ProjectEdge } from '../graph/model'
import type { Chain } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compareText } from '../graph/order'

/**
 * The depth of every project in the dependency graph: the longest chain of edges below it, a
 * cycle counted once.
 *
 * @param graph - The workspace graph
 * @returns The depth by project name
 */
export function dependencyLevels(graph: WorkspaceGraph): Map<string, number> {
  const levels = createMap<string, number>()
  const visiting = createSet<string>()
  const level = (name: string): number => {
    const known = levels.get(name)
    if (known !== undefined) return known
    if (visiting.has(name)) return 0
    visiting.add(name)
    let deepest = 0
    for (const edge of (graph.edges.get(name) ?? []) as readonly ProjectEdge[]) {
      if (edge.target !== name) deepest = max(deepest, level(edge.target) + 1)
    }
    visiting.delete(name)
    levels.set(name, deepest)
    return deepest
  }
  for (const name of graph.projects.keys()) level(name)
  return levels
}

/**
 * The category of a chain: 0 for a library with a build, 1 for another library or a tool, 2 for
 * an application.
 *
 * @param graph - The graph the chain's project belongs to
 * @param chain - The chain categorised
 * @returns 0, 1 or 2
 */
function categoryOf(graph: WorkspaceGraph, chain: Chain): number {
  const project = graph.projects.get(chain.project)
  if (project === undefined || project.type === 'app') return 2
  return chain.tasks.some((item) => item.target === 'build') ? 0 : 1
}

/**
 * The chains ranked: by category, then the deepest project first, then by name; the rank is
 * written into each chain's `order`.
 *
 * @param graph - The graph the chains' projects belong to
 * @param chains - The chains, in any order
 * @returns The chains in rank order, each carrying its rank
 */
export function rankChains(graph: WorkspaceGraph, chains: readonly Chain[]): Chain[] {
  const levels = dependencyLevels(graph)
  return [...chains]
    .sort(
      (left, right) =>
        categoryOf(graph, left) - categoryOf(graph, right) ||
        (levels.get(right.project) ?? 0) - (levels.get(left.project) ?? 0) ||
        compareText(left.project, right.project) ||
        compareText(left.environment, right.environment)
    )
    .map((chain, index) => ({ ...chain, order: index }))
}
