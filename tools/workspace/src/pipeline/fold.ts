/**
 * How a selection becomes tasks: an e2e task joins the chain of the library it tests, a built
 * publishable library gains its floor probe and, when its e2e project ships a consumer smoke,
 * its smokes, a published library gains the build its publish needs, the Windows environment
 * takes the typecheck, lint and test of the libraries and tools, and every task learns what it
 * needs.
 *
 * @module pipeline/fold
 */

import type { WorkspaceGraph } from '../graph/build'
import type { ProjectRecord } from '../graph/model'
import type { Chain, Environment, PlanReason, PlanTask } from './model'
import { posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { targetDependsOn } from '../graph/inputs'
import { compareText } from '../graph/order'
import { hasTarget } from '../graph/workspace'
import { declaredFloor, majorOf, nodeCommand, nxCommand, PipelineTarget, PROBE_SCRIPT, SMOKE_SCRIPT, targetRank } from './commands'
import { Environment as Environments, PipelineRule, planReason, splitTaskId, Weight } from './model'

/** The targets the Windows environment runs for every library and tool. */
const WINDOWS_TARGETS = createSet(['typecheck', 'lint', 'test'])

/** The projects the Windows environment covers. */
const WINDOWS_PROJECTS = /^(lib|tool)-/

/** The targets that run after a chain's build. */
const AFTER_BUILD = createSet<string>(['e2e', PipelineTarget.Probe, PipelineTarget.SmokeFloor, PipelineTarget.SmokeMajor, 'publish'])

/** What a task is made of before its needs are known. */
type TaskFields = Omit<PlanTask, 'needs' | 'env'> & Partial<Pick<PlanTask, 'env'>>

/**
 * A task without needs yet.
 *
 * @param fields - Everything but the needs
 * @returns The task, with an empty environment unless given one
 */
function task(fields: TaskFields): PlanTask {
  return { ...fields, env: fields.env ?? {}, needs: [] }
}

/**
 * Whether a project publishes a package.
 *
 * @param project - Any project of the graph
 * @returns True for a public package with a publish target
 */
export function isPublishable(project: ProjectRecord): boolean {
  return project.manifest !== null && project.manifest.private !== true && hasTarget(project, 'publish')
}

/**
 * The library an e2e project tests.
 *
 * @param graph - The graph the projects belong to
 * @param project - A project with an e2e target
 * @returns The first implicit dependency with a build target, or null
 */
export function libraryOfE2e(graph: WorkspaceGraph, project: ProjectRecord): ProjectRecord | null {
  for (const name of project.implicitDependencies) {
    const candidate = graph.projects.get(name)
    if (candidate !== undefined && hasTarget(candidate, 'build')) return candidate
  }
  return null
}

/**
 * The e2e projects testing a library.
 *
 * @param graph - The graph the projects belong to
 * @param library - The library tested
 * @returns The projects with an e2e target naming the library as an implicit dependency, by name
 */
export function e2eProjectsOf(graph: WorkspaceGraph, library: ProjectRecord): ProjectRecord[] {
  return [...graph.projects.values()]
    .filter((project) => hasTarget(project, 'e2e') && project.implicitDependencies.includes(library.name))
    .sort((left, right) => compareText(left.name, right.name))
}

/**
 * The workspace packages a library's published manifest depends on.
 *
 * @param graph - The graph the projects belong to
 * @param project - The library
 * @returns The projects named by the manifest's dependencies and peer dependencies
 */
export function upstreamPackages(graph: WorkspaceGraph, project: ProjectRecord): ProjectRecord[] {
  const byPackage = createMap<string, ProjectRecord>()
  for (const candidate of graph.projects.values()) {
    if (candidate.manifest?.name !== undefined) byPackage.set(candidate.manifest.name, candidate)
  }
  const named = [...keys(project.manifest?.dependencies ?? {}), ...keys(project.manifest?.peerDependencies ?? {})]
  return named.map((name) => byPackage.get(name)).filter((candidate): candidate is ProjectRecord => candidate !== undefined)
}

/**
 * The tasks the pipeline runs after a library's build on the Linux environment: the floor probe
 * of a publishable package, and the consumer smokes of a library whose e2e project ships one.
 *
 * @param graph - The graph the projects belong to
 * @param library - The built library
 * @param environment - Where the tasks run
 * @param smokesOnly - Whether to leave the probe out
 * @returns The tasks
 */
function afterBuild(graph: WorkspaceGraph, library: ProjectRecord, environment: Environment, smokesOnly: boolean): PlanTask[] {
  const build = `${library.name}:build`
  const floor = declaredFloor(library.manifest?.engines?.['node'])
  const tasks: PlanTask[] = []
  if (!smokesOnly && isPublishable(library)) {
    tasks.push(
      task({
        id: `${library.name}:${PipelineTarget.Probe}`,
        project: library.name,
        target: PipelineTarget.Probe,
        environment,
        weight: Weight.Light,
        reasons: [
          planReason(PipelineRule.PipelineTask, `loads every entry of the built package on Node.js ${floor ?? 'of the workspace'}`, [
            build,
          ]),
        ],
        command: nodeCommand(floor, PROBE_SCRIPT),
        env: { HF_DIST: posix.join('dist', library.root) },
      })
    )
  }
  for (const e2e of e2eProjectsOf(graph, library)) {
    const script = posix.join(e2e.root, SMOKE_SCRIPT)
    if (!e2e.files.includes(script)) continue
    const releases: [string, string | null][] =
      floor === null
        ? [[PipelineTarget.SmokeFloor, null]]
        : [
            [PipelineTarget.SmokeFloor, floor],
            [PipelineTarget.SmokeMajor, majorOf(floor)],
          ]
    for (const [target, release] of releases) {
      tasks.push(
        task({
          id: `${library.name}:${target}`,
          project: library.name,
          target,
          environment,
          weight: Weight.Light,
          reasons: [
            planReason(PipelineRule.PipelineTask, `drives the packed package from a consumer on Node.js ${release ?? 'of the workspace'}`, [
              build,
            ]),
          ],
          command: nodeCommand(release, script),
        })
      )
    }
  }
  return tasks
}

/**
 * The Linux tasks of a selection: one per selected task, e2e tasks folded into their library's
 * chain, then the probes, smokes and builds the pipeline adds.
 *
 * @param graph - The graph the projects belong to
 * @param selected - The selected task ids with their reasons
 * @param main - Whether publish tasks are kept
 * @returns The tasks, without needs
 */
export function linuxTasks(graph: WorkspaceGraph, selected: ReadonlyMap<string, readonly PlanReason[]>, main: boolean): PlanTask[] {
  const tasks = createMap<string, PlanTask>()
  for (const [id, reasons] of selected) {
    const { project: name, target } = splitTaskId(id)
    const project = graph.projects.get(name)
    if (project === undefined) continue
    if (target === 'publish' && (!main || !isPublishable(project))) continue
    const library = target === 'e2e' ? libraryOfE2e(graph, project) : null
    const folded =
      library === null
        ? []
        : [planReason(PipelineRule.Folded, `runs in the chain of ${library.name}, the library it tests`, [`${library.name}:build`])]
    tasks.set(
      id,
      task({
        id,
        project: library?.name ?? name,
        target,
        environment: Environments.Linux,
        weight: target === 'build' && project.type === 'lib' ? Weight.Heavy : Weight.Light,
        reasons: [...reasons, ...folded],
        command: nxCommand(id),
      })
    )
  }
  for (const item of [...tasks.values()]) {
    if (item.target !== 'publish' || tasks.has(`${item.project}:build`)) continue
    const build = `${item.project}:build`
    tasks.set(
      build,
      task({
        id: build,
        project: item.project,
        target: 'build',
        environment: Environments.Linux,
        weight: Weight.Heavy,
        reasons: [planReason(PipelineRule.PipelineTask, `builds what ${item.id} publishes`, [item.id])],
        command: nxCommand(build),
      })
    )
  }
  for (const item of [...tasks.values()]) {
    if (item.target !== 'build') continue
    const library = graph.projects.get(item.project)
    if (library === undefined) continue
    for (const added of afterBuild(graph, library, Environments.Linux, false)) tasks.set(added.id, added)
  }
  return [...tasks.values()]
}

/**
 * The Windows tasks: the typecheck, lint and test of every library and tool among the Linux
 * tasks, and the build and smokes of a library whose e2e project ships a consumer smoke.
 *
 * @param graph - The graph the projects belong to
 * @param linux - What the Linux environment runs
 * @returns The tasks, without needs
 */
export function windowsTasks(graph: WorkspaceGraph, linux: readonly PlanTask[]): PlanTask[] {
  const tasks: PlanTask[] = []
  for (const item of linux) {
    if (WINDOWS_TARGETS.has(item.target) && WINDOWS_PROJECTS.test(item.project)) tasks.push({ ...item, environment: Environments.Windows })
  }
  for (const item of linux) {
    if (item.target !== 'build') continue
    const library = graph.projects.get(item.project)
    if (library === undefined) continue
    const smokes = afterBuild(graph, library, Environments.Windows, true)
    if (smokes.length === 0) continue
    tasks.push({ ...item, environment: Environments.Windows }, ...smokes)
  }
  return tasks
}

/**
 * The tasks with their needs: a build after its chain's typecheck, what runs after a build
 * after it, a publish after everything else of its chain and after the publishes of the packages
 * it depends on, and a task after the same project's tasks its `dependsOn` names, whenever the
 * task needed is in the same environment.
 *
 * @param graph - The graph the projects belong to
 * @param tasks - The tasks of every environment
 * @returns The same tasks with their needs filled in
 */
export function withNeeds(graph: WorkspaceGraph, tasks: readonly PlanTask[]): PlanTask[] {
  const present = createSet(tasks.map((item) => `${item.environment} ${item.id}`))
  const has = (environment: Environment, id: string): boolean => present.has(`${environment} ${id}`)
  return tasks.map((item) => {
    const needs = createSet<string>()
    const own = (target: string): string => `${item.project}:${target}`
    if (item.target === 'build' && has(item.environment, own('typecheck'))) needs.add(own('typecheck'))
    if (AFTER_BUILD.has(item.target) && has(item.environment, own('build'))) needs.add(own('build'))
    const { project: name, target } = splitTaskId(item.id)
    const project = graph.projects.get(name)
    if (item.target === 'publish' && project !== undefined) {
      for (const other of tasks) {
        if (other.environment === item.environment && other.project === item.project && other.id !== item.id && other.target !== 'publish')
          needs.add(other.id)
      }
      for (const upstream of upstreamPackages(graph, project)) {
        if (upstream.name !== project.name && has(item.environment, `${upstream.name}:publish`)) needs.add(`${upstream.name}:publish`)
      }
    }
    if (project !== undefined) {
      for (const entry of targetDependsOn(graph.root, project, target)) {
        if (typeof entry === 'string' && !entry.startsWith('^') && entry !== target && has(item.environment, `${name}:${entry}`))
          needs.add(`${name}:${entry}`)
      }
    }
    return { ...item, needs: [...needs].sort(compareText) }
  })
}

/**
 * The tasks grouped into chains, each chain's tasks in an order that places every need before
 * the task needing it.
 *
 * @param tasks - The tasks with their needs
 * @returns One chain per project and environment, by environment then project, unranked
 */
export function buildChains(tasks: readonly PlanTask[]): Chain[] {
  const groups = createMap<string, PlanTask[]>()
  for (const item of tasks) {
    const key = `${item.environment} ${item.project}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.values()]
    .map((members) => {
      const ordered: PlanTask[] = []
      const placed = createSet<string>()
      const remaining = [...members].sort(
        (left, right) => targetRank(left.target) - targetRank(right.target) || compareText(left.id, right.id)
      )
      while (remaining.length > 0) {
        const index = remaining.findIndex((item) =>
          item.needs.every((need) => placed.has(need) || !members.some((member) => member.id === need))
        )
        const [next] = remaining.splice(index === -1 ? 0 : index, 1)
        ordered.push(next as PlanTask)
        placed.add((next as PlanTask).id)
      }
      const [first] = ordered
      return { project: (first as PlanTask).project, environment: (first as PlanTask).environment, order: 0, tasks: ordered }
    })
    .sort((left, right) => compareText(left.environment, right.environment) || compareText(left.project, right.project))
}
