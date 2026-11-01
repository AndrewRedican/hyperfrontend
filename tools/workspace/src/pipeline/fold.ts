/**
 * How a selection becomes tasks: an e2e task joins the chain of the library it tests, every task
 * gains the tasks it needs first as tasks of its own (what its `dependsOn` names, the build of
 * the library an e2e task tests, the build a publish publishes), each planned once however many
 * tasks need it, a built publishable library gains its floor probe and, when its e2e project
 * ships a consumer smoke, its smokes, a built demo that declares a Railway service gains its
 * deploy on `main`, the workspace gains the provision those deploys wait on, the Windows
 * environment takes the typecheck, lint and test of the libraries and tools, and every task
 * learns what it needs.
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
import { libraryOfE2e, prerequisitesOf } from '../graph/depends-on'
import { compareText } from '../graph/order'
import { projectOfFile } from '../graph/resolve'
import { hasTarget } from '../graph/workspace'
import {
  declaredFloor,
  DEPLOY_SCRIPT,
  majorOf,
  nodeCommand,
  PipelineTarget,
  PROBE_SCRIPT,
  PROVISION_SCRIPT,
  RAILWAY_CONFIG,
  SMOKE_SCRIPT,
  targetRank,
  taskCommand,
} from './commands'
import { Environment as Environments, PipelineRule, planReason, splitTaskId, Weight } from './model'

/** The targets the Windows environment runs for every library and tool. */
const WINDOWS_TARGETS = createSet(['typecheck', 'lint', 'test'])

/** The projects the Windows environment covers. */
const WINDOWS_PROJECTS = /^(lib|tool)-/

/** The targets that run after a chain's build, when the plan builds it. */
const AFTER_BUILD = createSet<string>([
  'e2e',
  PipelineTarget.Probe,
  PipelineTarget.SmokeFloor,
  PipelineTarget.SmokeMajor,
  'publish',
  // why: a verify rebuilds the output it checks, so it must never run beside the build writing the same directory
  'verify',
  PipelineTarget.Deploy,
])

/** The targets that run after every other task of their chain. */
// why: the provision runs after the workspace's lint, which checks the file it applies
const CHAIN_LAST = createSet<string>(['publish', PipelineTarget.Provision, PipelineTarget.Deploy])

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

/** What a project's `metadata.deploy` declares, as far as the pipeline reads it. */
interface DeployMetadata {
  /** The provider. */
  readonly provider?: unknown
  /** The service. */
  readonly service?: unknown
}

/**
 * The Railway service a project deploys to.
 *
 * @param project - Any project of the graph
 * @returns The service `metadata.deploy` names when its provider is `railway`, else null
 */
export function railwayService(project: ProjectRecord): string | null {
  const deploy = project.configuration?.metadata?.['deploy'] as DeployMetadata | undefined
  return deploy?.provider === 'railway' && typeof deploy.service === 'string' ? deploy.service : null
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
 * The deploy after a demo's build: the commit the run is of goes to the Railway service the demo
 * declares, once the chain's other tasks have passed.
 *
 * @param project - The built project
 * @param environment - Where the task runs
 * @returns The task, or null when the project declares no Railway service
 */
function deployTask(project: ProjectRecord, environment: Environment): PlanTask | null {
  const service = railwayService(project)
  if (service === null) return null
  return task({
    id: `${project.name}:${PipelineTarget.Deploy}`,
    project: project.name,
    target: PipelineTarget.Deploy,
    environment,
    weight: Weight.Light,
    reasons: [planReason(PipelineRule.PipelineTask, `deploys the commit to the Railway service ${service}`, [`${project.name}:build`])],
    command: ['node', DEPLOY_SCRIPT],
    env: { HF_DEPLOY_SERVICE: service },
  })
}

/**
 * The provision before the deploys: the Railway configuration goes to the production environment
 * in the chain of the project owning it, the workspace's root project.
 *
 * @param graph - The graph the projects belong to
 * @param environment - Where the task runs
 * @returns The task, or null when no project owns the configuration
 */
function provisionTask(graph: WorkspaceGraph, environment: Environment): PlanTask | null {
  const owner = projectOfFile(graph.projects, RAILWAY_CONFIG)
  if (owner === null) return null
  return task({
    id: `${owner.name}:${PipelineTarget.Provision}`,
    project: owner.name,
    target: PipelineTarget.Provision,
    environment,
    weight: Weight.Light,
    reasons: [planReason(PipelineRule.PipelineTask, `applies ${RAILWAY_CONFIG} to the production environment before the deploys`)],
    command: ['node', PROVISION_SCRIPT],
  })
}

/**
 * A task of a project's target: an e2e task in the chain of the library it tests, any other in
 * its own project's chain; heavy for a library build, light otherwise.
 *
 * @param graph - The graph the projects belong to
 * @param id - `<project>:<target>`, of a project the graph knows
 * @param reasons - Why the task is in the plan
 * @param environment - Where the task runs
 * @returns The task, without needs
 */
function projectTask(graph: WorkspaceGraph, id: string, reasons: readonly PlanReason[], environment: Environment): PlanTask {
  const { project: name, target } = splitTaskId(id)
  const project = graph.projects.get(name) as ProjectRecord
  const library = target === 'e2e' ? libraryOfE2e(graph, project) : null
  const folded =
    library === null
      ? []
      : [planReason(PipelineRule.Folded, `runs in the chain of ${library.name}, the library it tests`, [`${library.name}:build`])]
  return task({
    id,
    project: library?.name ?? name,
    target,
    environment,
    weight: target === 'build' && project.type === 'lib' ? Weight.Heavy : Weight.Light,
    reasons: [...reasons, ...folded],
    command: taskCommand(id),
  })
}

/**
 * The tasks a task needs first, as its `dependsOn` names them.
 *
 * @param graph - The graph the projects belong to
 * @param item - The task, of a project the graph knows
 * @returns The task ids, each once
 */
function prerequisiteIds(graph: WorkspaceGraph, item: PlanTask): string[] {
  const { project: name, target } = splitTaskId(item.id)
  return prerequisitesOf(graph, graph.projects.get(name) as ProjectRecord, target).map((prerequisite) => prerequisite.id)
}

/**
 * Adds the tasks the tasks of one environment need first, transitively and each once. A task
 * already planned keeps its reasons; a task added runs the owned task command, joins its own
 * project's chain and carries a reason naming the tasks that need it.
 *
 * @param graph - The graph the projects belong to
 * @param tasks - The environment's tasks by id, which the added tasks join
 * @param environment - Where the tasks run
 */
function addPrerequisites(graph: WorkspaceGraph, tasks: Map<string, PlanTask>, environment: Environment): void {
  const dependents = createMap<string, string[]>()
  const queue = [...tasks.values()]
  // why: the loop also visits the tasks it appends, so the prerequisites of an added task are added too.
  for (const item of queue) {
    for (const id of prerequisiteIds(graph, item)) {
      const known = tasks.get(id)
      if (known !== undefined && !dependents.has(id)) continue
      dependents.set(id, [...(dependents.get(id) ?? []), item.id])
      if (known !== undefined) continue
      const added = projectTask(graph, id, [], environment)
      tasks.set(id, added)
      queue.push(added)
    }
  }
  for (const [id, needing] of dependents) {
    const added = tasks.get(id) as PlanTask
    const names = [...needing].sort(compareText)
    tasks.set(id, {
      ...added,
      reasons: [planReason(PipelineRule.PipelineTask, `needed first by ${names.join(', ')}`, names), ...added.reasons],
    })
  }
}

/**
 * The Linux tasks of a selection: one per selected task, e2e tasks folded into their library's
 * chain, then every task they need first, then the probes and smokes after the library builds
 * and, on `main`, the deploys after the builds of the demos that declare a Railway service and
 * the provision, whenever a deploy is planned or the Railway configuration changed.
 *
 * @param graph - The graph the projects belong to
 * @param selected - The selected task ids with their reasons
 * @param main - Whether publish, provision and deploy tasks are kept
 * @param railwayChanged - Whether the change reaches the Railway configuration
 * @returns The tasks, without needs
 */
export function linuxTasks(
  graph: WorkspaceGraph,
  selected: ReadonlyMap<string, readonly PlanReason[]>,
  main: boolean,
  railwayChanged = false
): PlanTask[] {
  const tasks = createMap<string, PlanTask>()
  for (const [id, reasons] of selected) {
    const { project: name, target } = splitTaskId(id)
    const project = graph.projects.get(name)
    if (project === undefined) continue
    if (target === 'publish' && (!main || !isPublishable(project))) continue
    tasks.set(id, projectTask(graph, id, reasons, Environments.Linux))
  }
  addPrerequisites(graph, tasks, Environments.Linux)
  for (const item of [...tasks.values()]) {
    if (item.target !== 'build') continue
    const project = graph.projects.get(item.project) as ProjectRecord
    for (const added of afterBuild(graph, project, Environments.Linux, false)) tasks.set(added.id, added)
    const deploy = main ? deployTask(project, Environments.Linux) : null
    if (deploy !== null) tasks.set(deploy.id, deploy)
  }
  const deploys = [...tasks.values()].some((item) => item.target === PipelineTarget.Deploy)
  const provision = main && (deploys || railwayChanged) ? provisionTask(graph, Environments.Linux) : null
  if (provision !== null) tasks.set(provision.id, provision)
  return [...tasks.values()]
}

/**
 * The Windows tasks: the typecheck, lint and test of every library and tool among the Linux
 * tasks, the build and smokes of a library whose e2e project ships a consumer smoke, and every
 * task they need first.
 *
 * @param graph - The graph the projects belong to
 * @param linux - What the Linux environment runs
 * @returns The tasks, without needs
 */
export function windowsTasks(graph: WorkspaceGraph, linux: readonly PlanTask[]): PlanTask[] {
  const tasks = createMap<string, PlanTask>()
  for (const item of linux) {
    if (WINDOWS_TARGETS.has(item.target) && WINDOWS_PROJECTS.test(item.project))
      tasks.set(item.id, { ...item, environment: Environments.Windows })
  }
  for (const item of linux) {
    if (item.target !== 'build') continue
    const smokes = afterBuild(graph, graph.projects.get(item.project) as ProjectRecord, Environments.Windows, true)
    if (smokes.length === 0) continue
    const names = smokes.map((smoke) => smoke.id).sort(compareText)
    // why: the Linux build's own prerequisite reason names Linux tasks; on Windows the build is there for the smokes
    const reasons = [
      planReason(PipelineRule.PipelineTask, `needed first by ${names.join(', ')}`, names),
      ...item.reasons.filter((reason) => reason.rule !== PipelineRule.PipelineTask),
    ]
    for (const added of [{ ...item, environment: Environments.Windows, reasons }, ...smokes]) tasks.set(added.id, added)
  }
  addPrerequisites(graph, tasks, Environments.Windows)
  return [...tasks.values()]
}

/**
 * The tasks with their needs: a build after its chain's typecheck, what runs after a build
 * after it, a publish, a provision or a deploy after everything else of its chain, a publish after
 * the publishes of the packages it depends on, a deploy after the provision, and a task after
 * every task it needs first (what its `dependsOn` names, another project's task included),
 * whenever the task needed is in the same environment.
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
    if (CHAIN_LAST.has(item.target)) {
      for (const other of tasks) {
        if (other.environment === item.environment && other.project === item.project && !CHAIN_LAST.has(other.target)) needs.add(other.id)
      }
    }
    if (item.target === 'publish') {
      const project = graph.projects.get(item.project) as ProjectRecord
      for (const upstream of upstreamPackages(graph, project)) {
        if (upstream.name !== project.name && has(item.environment, `${upstream.name}:publish`)) needs.add(`${upstream.name}:publish`)
      }
    }
    if (item.target === PipelineTarget.Deploy) {
      for (const other of tasks) {
        if (other.environment === item.environment && other.target === PipelineTarget.Provision) needs.add(other.id)
      }
    }
    for (const id of prerequisiteIds(graph, item)) {
      if (has(item.environment, id)) needs.add(id)
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
