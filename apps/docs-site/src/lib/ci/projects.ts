import type { ChainStatus, Execution, ExecutionChain, ExecutionTask, StateCounts } from './execution'
import type { Presentation } from './labels'
import type { Environment } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { countStates, spanOf } from './execution'
import { presentProject } from './labels'

/** One task placed in a chain's graph. */
export interface GraphNode {
  /** The task */
  task: ExecutionTask
  /** The column: zero for a task that needs nothing in the chain, one more than its deepest need otherwise */
  column: number
  /** The row within the column, in chain order */
  row: number
  /** The needs that are tasks of other chains */
  externalNeeds: readonly string[]
}

/** A need inside a chain. */
export interface GraphEdge {
  /** The task needed first */
  from: string
  /** The task needing it */
  to: string
}

/** A chain's tasks laid out left to right along their needs. */
export interface TaskGraph {
  /** The nodes, in chain order */
  nodes: readonly GraphNode[]
  /** The needs between them */
  edges: readonly GraphEdge[]
  /** How many columns */
  columns: number
  /** How many rows the tallest column has */
  rows: number
}

/** One project's chain on one environment. */
export interface ProjectLane {
  /** The environment */
  environment: Environment
  /** The chain */
  chain: ExecutionChain
  /** Its tasks laid out */
  graph: TaskGraph
}

/** One project across every environment it runs on. */
export interface ProjectGroup {
  /** The project */
  project: string
  /** How it is presented */
  presentation: Presentation
  /** The lowest rank among its chains */
  order: number
  /** Its chains, in environment order */
  lanes: readonly ProjectLane[]
  /** The worst status among its chains */
  status: ChainStatus
  /** How many of its tasks stand each way, over every environment */
  counts: StateCounts
  /** How many tasks over every environment */
  total: number
  /** When its first task started, or null */
  startedAt: number | null
  /** When its last task ended, or null */
  endedAt: number | null
  /** The tasks that failed or were cancelled, in chain order */
  attention: readonly ExecutionTask[]
}

/** The chain statuses from the one that needs attention most to the one that needs none. */
const STATUS_SEVERITY: readonly ChainStatus[] = ['failure', 'cancelled', 'incomplete', 'running', 'queued', 'success']

/**
 * The worst of some chain statuses.
 *
 * @param statuses - The statuses of some chains
 * @returns The one that needs attention most; success when there are none
 */
export function worstStatus(statuses: readonly ChainStatus[]): ChainStatus {
  return STATUS_SEVERITY.find((status) => statuses.includes(status)) ?? 'success'
}

/**
 * Whether one task of a chain reaches another through the chain's needs, in more than one step.
 *
 * @param chain - The chain whose needs are followed
 * @param from - The task reached
 * @param to - The task needing it
 * @returns True when some other task of the chain needs `from` and is needed, directly or not, by `to`
 */
function impliedNeed(chain: ExecutionChain, from: string, to: string): boolean {
  const byId = createMap(chain.tasks.map((task) => [task.id, task] as const))
  const reaches = (id: string, target: string, seen: Set<string>): boolean => {
    for (const need of byId.get(id)?.needs ?? []) {
      if (need === target) return true
      if (!seen.has(need) && byId.has(need)) {
        seen.add(need)
        if (reaches(need, target, seen)) return true
      }
    }
    return false
  }
  return (byId.get(to)?.needs ?? []).some((need) => need !== from && byId.has(need) && reaches(need, from, createSet()))
}

/**
 * A chain's tasks laid out along their needs: a task sits one column right of the deepest task
 * of the chain it needs, needs on tasks of other chains are kept aside, and a need another need
 * already implies is not drawn, so the graph shows the chain's order rather than every pair.
 *
 * @param chain - The chain whose tasks are laid out
 * @returns The graph, its needs as edges
 */
export function layoutChain(chain: ExecutionChain): TaskGraph {
  const own = createSet(chain.tasks.map((task) => task.id))
  const columns = createMap<string, number>()
  const columnOf = (task: ExecutionTask): number => {
    const known = columns.get(task.id)
    if (known !== undefined) return known
    let column = 0
    for (const need of task.needs) {
      const needed = chain.tasks.find((candidate) => candidate.id === need)
      if (needed !== undefined && needed !== task) column = max(column, columnOf(needed) + 1)
    }
    columns.set(task.id, column)
    return column
  }
  const rowsUsed = createMap<number, number>()
  const nodes: GraphNode[] = chain.tasks.map((task) => {
    const column = columnOf(task)
    const row = rowsUsed.get(column) ?? 0
    rowsUsed.set(column, row + 1)
    return { task, column, row, externalNeeds: task.needs.filter((need) => !own.has(need)) }
  })
  const edges: GraphEdge[] = chain.tasks.flatMap((task) =>
    task.needs.filter((need) => own.has(need) && !impliedNeed(chain, need, task.id)).map((need) => ({ from: need, to: task.id }))
  )
  return {
    nodes,
    edges,
    columns: nodes.length === 0 ? 0 : max(...nodes.map((node) => node.column)) + 1,
    rows: max(0, ...rowsUsed.values()),
  }
}

/**
 * The projects of an execution, each with its chain on every environment it runs on.
 *
 * @param execution - The execution whose chains are grouped
 * @returns The projects, in the order the scheduler ranks their first chain
 */
export function groupProjects(execution: Execution): ProjectGroup[] {
  const groups = createMap<string, ExecutionChain[]>()
  for (const chain of execution.chains) groups.set(chain.project, [...(groups.get(chain.project) ?? []), chain])
  return [...groups]
    .map(([project, chains]) => {
      const lanes: ProjectLane[] = execution.lanes
        .map((lane) => chains.find((chain) => chain.environment === lane.environment))
        .filter((chain): chain is ExecutionChain => chain !== undefined)
        .map((chain) => ({ environment: chain.environment, chain, graph: layoutChain(chain) }))
      const tasks = chains.flatMap((chain) => [...chain.tasks])
      const span = spanOf(
        chains.map((chain) => chain.startedAt),
        chains.map((chain) => chain.endedAt)
      )
      return {
        project,
        presentation: presentProject(project),
        order: min(...chains.map((chain) => chain.order)),
        lanes,
        status: worstStatus(chains.map((chain) => chain.status)),
        counts: countStates(tasks),
        total: tasks.length,
        startedAt: span.start,
        endedAt: span.end,
        attention: tasks.filter((task) => task.state === 'failure' || task.state === 'cancelled'),
      }
    })
    .sort((left, right) => left.order - right.order)
}
