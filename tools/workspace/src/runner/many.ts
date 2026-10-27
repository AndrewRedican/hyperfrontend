/**
 * Runs many tasks of the workspace, `run-many -t <targets> [-p <names and globs> | --all]`: the
 * requested tasks and every task their `dependsOn` reaches, in an order where each runs after its
 * prerequisites, one at a time, each in a child of its own. A task whose prerequisite failed is
 * skipped; the rest still run. Nothing is cached or restored.
 *
 * @module runner/many
 */

import type { WorkspaceGraph } from '../graph/build'
import type { ProjectRecord } from '../graph/model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { prerequisitesOf } from '../graph/depends-on'
import { hasTarget } from '../graph/workspace'

/** What the `affected` command line expects. */
export const AFFECTED_USAGE = 'usage: hf affected -t <target[,target]> [--base=<ref>] [--head=<ref>] [--name=value ...]'

/** What the command line expects. */
export const MANY_USAGE = 'usage: hf run-many -t <target[,target]> [-p <name|glob[,...]> | --all] [--name=value ...]'

/** The tasks asked for and the arguments every requested task receives. */
export interface ManyRequest {
  /** The targets. */
  readonly targets: readonly string[]
  /** The project names and globs, or null for every project. */
  readonly projects: readonly string[] | null
  /** The arguments after the selection, passed to each requested task. */
  readonly args: readonly string[]
}

/** The targets asked for over a change, and the arguments every requested task receives. */
export interface AffectedRequest {
  /** The targets. */
  readonly targets: readonly string[]
  /** The base revision, `origin/main` when none is named. */
  readonly base: string
  /** The head revision, or null for the working tree. */
  readonly head: string | null
  /** The arguments after the selection, passed to each requested task. */
  readonly args: readonly string[]
}

/** A task named by its project and target. */
export interface TaskRef {
  /** The project's name. */
  readonly project: string
  /** The target. */
  readonly target: string
}

/** One task to run, in order. */
export interface PlannedTask {
  /** `<project>:<target>`. */
  readonly id: string
  /** Whether the task was asked for, rather than reached through `dependsOn`. */
  readonly requested: boolean
  /** The tasks it runs after. */
  readonly after: readonly string[]
}

/** How one task ended. */
export interface TaskOutcome {
  /** `<project>:<target>`. */
  readonly id: string
  /** Whether it ran and succeeded, ran and failed, or was skipped after a failed prerequisite. */
  readonly status: 'succeeded' | 'failed' | 'skipped'
  /** How long it ran, in milliseconds; 0 when skipped. */
  readonly durationMs: number
}

/** What running the tasks needs. */
export interface ManyHost {
  /** Runs one task in a child, with the arguments after it; resolves to the exit code. */
  readonly runChild: (id: string, args: readonly string[]) => Promise<number>
  /** The current time in milliseconds. */
  readonly now: () => number
  /** Writes a line to standard error. */
  readonly write: (line: string) => void
}

/**
 * The values of a list option, comma separated.
 *
 * @param value - The option's value
 * @returns The non-empty entries
 */
function listOf(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/**
 * Reads the command line of `run-many`.
 *
 * @param argv - The arguments after `run-many`
 * @returns The request
 * @throws {Error} When no target is named, or neither projects nor `--all`
 */
export function parseManyArgs(argv: readonly string[]): ManyRequest {
  const targets: string[] = []
  let projects: string[] | null = null
  let all = false
  const args: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] as string
    const [name, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined]
    if (name === '-t' || name === '--targets' || name === '--target') targets.push(...listOf(inline ?? argv[++index] ?? ''))
    else if (name === '-p' || name === '--projects') projects = [...(projects ?? []), ...listOf(inline ?? argv[++index] ?? '')]
    else if (name === '--all') all = true
    else args.push(arg)
  }
  if (targets.length === 0) throw createError('name the targets with -t')
  if (projects === null && !all) throw createError('name the projects with -p, or pass --all')
  return { targets, projects: all ? null : projects, args }
}

/**
 * Reads the command line of `affected`.
 *
 * @param argv - The arguments after `affected`
 * @returns The request
 * @throws {Error} When no target is named
 */
export function parseAffectedArgs(argv: readonly string[]): AffectedRequest {
  const targets: string[] = []
  let base = 'origin/main'
  let head: string | null = null
  const args: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] as string
    const [name, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined]
    if (name === '-t' || name === '--targets' || name === '--target') targets.push(...listOf(inline ?? argv[++index] ?? ''))
    else if (name === '--base') base = inline ?? argv[++index] ?? base
    else if (name === '--head') head = inline ?? argv[++index] ?? null
    else args.push(arg)
  }
  if (targets.length === 0) throw createError('name the targets with -t')
  return { targets, base, head, args }
}

/**
 * Whether a project name matches a name or a glob, where `*` matches any run of characters.
 *
 * @param name - The name of the project tested
 * @param pattern - The name or glob
 * @returns True when it matches
 */
export function matchesProject(name: string, pattern: string): boolean {
  const [first, ...rest] = pattern.split('*') as [string, ...string[]]
  if (rest.length === 0) return name === pattern
  const last = rest.pop() as string
  if (!name.startsWith(first) || name.length < first.length + last.length || !name.endsWith(last)) return false
  let at = first.length
  for (const part of rest) {
    const found = name.indexOf(part, at)
    if (found === -1 || found + part.length > name.length - last.length) return false
    at = found + part.length
  }
  return true
}

/**
 * Every task to run for a request, each after its prerequisites; a cycle is refused with its path.
 *
 * @param graph - The workspace graph
 * @param request - The targets and projects asked for
 * @returns The tasks in the order they run
 * @throws {Error} When a named project is unknown, or the tasks' prerequisites form a cycle
 */
export function planMany(graph: WorkspaceGraph, request: ManyRequest): PlannedTask[] {
  const projects = [...graph.projects.values()].sort((a, b) => (a.name < b.name ? -1 : 1))
  for (const pattern of request.projects ?? []) {
    if (!projects.some((project) => matchesProject(project.name, pattern))) throw createError(`no project matches ${pattern}`)
  }
  const chosen = projects.filter(
    (project) => request.projects === null || request.projects.some((pattern) => matchesProject(project.name, pattern))
  )
  const tasks: TaskRef[] = []
  for (const target of request.targets) {
    for (const project of chosen) if (hasTarget(project, target)) tasks.push({ project: project.name, target })
  }
  return planTasks(graph, tasks)
}

/**
 * The given tasks and every task their `dependsOn` reaches, each after its prerequisites, in the
 * order given otherwise; a cycle is refused with its path.
 *
 * @param graph - The workspace graph
 * @param tasks - The tasks asked for, each of a project of the graph
 * @returns The tasks in the order they run
 * @throws {Error} When the tasks' prerequisites form a cycle
 */
export function planTasks(graph: WorkspaceGraph, tasks: readonly TaskRef[]): PlannedTask[] {
  const order: PlannedTask[] = []
  const placed = createSet<string>()
  const requested = createSet<string>(tasks.map((task) => `${task.project}:${task.target}`))
  /**
   * Places a task after its prerequisites.
   *
   * @param project - The task's project
   * @param target - The task's target
   * @param path - The tasks being placed above it
   */
  const place = (project: ProjectRecord, target: string, path: readonly string[]): void => {
    const id = `${project.name}:${target}`
    if (placed.has(id)) return
    if (path.includes(id)) throw createError(`the tasks' dependsOn form a cycle: ${[...path.slice(path.indexOf(id)), id].join(' -> ')}`)
    const prerequisites = prerequisitesOf(graph, project, target)
    for (const prerequisite of prerequisites) {
      place(graph.projects.get(prerequisite.project) as ProjectRecord, prerequisite.target, [...path, id])
    }
    placed.add(id)
    order.push({ id, requested: requested.has(id), after: prerequisites.map((prerequisite) => prerequisite.id) })
  }
  for (const task of tasks) place(graph.projects.get(task.project) as ProjectRecord, task.target, [])
  return order
}

/**
 * Runs planned tasks one at a time, skipping any whose prerequisite did not succeed.
 *
 * @param tasks - The tasks in order
 * @param args - The arguments every requested task receives
 * @param host - How a task runs, the clock and the output
 * @returns How each task ended, in order
 */
export async function runPlanned(tasks: readonly PlannedTask[], args: readonly string[], host: ManyHost): Promise<TaskOutcome[]> {
  const outcomes: TaskOutcome[] = []
  const ended = createMap<string, TaskOutcome['status']>()
  for (const task of tasks) {
    const blocked = task.after.find((id) => ended.get(id) !== 'succeeded')
    if (blocked !== undefined) {
      host.write(`hf run-many: skipping ${task.id}: ${blocked} did not succeed`)
      ended.set(task.id, 'skipped')
      outcomes.push({ id: task.id, status: 'skipped', durationMs: 0 })
      continue
    }
    host.write(`hf run-many: ${task.id}`)
    const started = host.now()
    const code = await host.runChild(task.id, task.requested ? args : [])
    const status = code === 0 ? 'succeeded' : 'failed'
    ended.set(task.id, status)
    outcomes.push({ id: task.id, status, durationMs: host.now() - started })
  }
  return outcomes
}

/**
 * The summary of a run: one line per task and a count of each ending.
 *
 * @param outcomes - How each task ended
 * @returns The lines
 */
export function manySummary(outcomes: readonly TaskOutcome[]): string[] {
  const lines = outcomes.map((outcome) => `  ${outcome.status.padEnd(9)} ${outcome.id} (${(outcome.durationMs / 1000).toFixed(1)} s)`)
  const count = (status: TaskOutcome['status']): number => outcomes.filter((outcome) => outcome.status === status).length
  lines.push(`${count('succeeded')} succeeded, ${count('failed')} failed, ${count('skipped')} skipped`)
  return lines
}
