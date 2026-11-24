/**
 * The plan of a change: the owned selection of every pipeline target, the tasks the pipeline adds
 * (every task a planned task needs first, the probes and smokes after the builds, and on `main`
 * the deploys of the demos and services whose build the change can alter and the provision they wait on), the
 * registry drift of `main`, and the chains the two environments run, ranked for the scheduler.
 *
 * @module pipeline/plan
 */

import type {
  AffectedSet,
  BaseTsconfig,
  ChangeSet,
  PackageManifest,
  SelectOptions,
  WorkspaceFile,
  WorkspaceGraph,
} from '@hyperfrontend/workspace/graph'
import type { Environment, Plan, PlanReason, SkippedTask } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compareText, ENGINE_INPUT, EXECUTOR_SHARED_INPUT, hasTarget, projectOfFile, selectAffected } from '@hyperfrontend/workspace/graph'
import { ENVIRONMENT_JOB_FILES, HF_ENTRY, HF_SOURCE, RAILWAY_CONFIG } from './commands'
import { buildChains, e2eProjectsOf, isPublishable, linuxTasks, siblingTasks, withNeeds } from './fold'
import { Environment as Environments, PipelineRule, planReason } from './model'
import { rankChains } from './order'

/** The targets the pipeline selects on every change. */
export const CI_TARGETS = freeze(['typecheck', 'lint', 'test', 'build', 'e2e'] as const)

/** The target whose output a deploy ships. */
const BUILD_TARGET = 'build'

/**
 * The named input `hf.json` gives the manifest of the builder. A release counts it, since the
 * builder's dependencies shape what every library ships; a plan leaves it out, since a build
 * inside the workspace takes those dependencies from the root install, whose manifest and lock
 * file select every task when they change.
 */
export const TOOLCHAIN_MANIFEST_INPUT = 'toolchainManifest'

/** What a plan needs. */
export interface PlanOptions {
  /** The graph at the head. */
  readonly graph: WorkspaceGraph
  /** The change set, or null to run everything. */
  readonly changes: ChangeSet | null
  /** Whether publishes are planned. */
  readonly main: boolean
  /** The targets selected; the pipeline's by default. */
  readonly targets?: readonly string[]
  /** The publishable projects whose current version the registry lacks. */
  readonly drift?: readonly string[]
  /** The graph at the base, which lets a deleted or renamed module name the tasks it reached. */
  readonly previous?: WorkspaceGraph
  /** The `hf.json` at the base, which lets a change to it select only the tasks that resolve differently afterwards. */
  readonly previousWorkspace?: WorkspaceFile
  /** The `tsconfig.base.json` at the base, which lets a change to its path aliases alone select only the tasks reading a file that imports through an alias that differs. */
  readonly previousBaseTsconfig?: BaseTsconfig
}

/** The selected tasks and the skipped decisions of one plan. */
interface Selection {
  /** The reasons of each selected task, by id. */
  readonly selected: Map<string, PlanReason[]>
  /** The decisions of the tasks skipped. */
  readonly skipped: SkippedTask[]
}

/**
 * Adds a reason to a task's selection.
 *
 * @param selection - The selection the reason joins
 * @param id - The task id
 * @param reason - Why the task is selected
 */
function select(selection: Selection, id: string, reason: PlanReason): void {
  selection.selected.set(id, [...(selection.selected.get(id) ?? []), reason])
}

/**
 * The selection of a plan running everything.
 *
 * @param graph - The workspace graph
 * @param targets - The targets run
 * @returns Every task of every project with the target
 */
function selectAll(graph: WorkspaceGraph, targets: readonly string[]): Selection {
  const selection: Selection = { selected: createMap(), skipped: [] }
  for (const project of graph.projects.values()) {
    for (const target of targets) {
      if (hasTarget(project, target))
        select(selection, `${project.name}:${target}`, planReason(PipelineRule.FullPlan, 'every task of every project runs'))
    }
  }
  return selection
}

/**
 * The selection of a change: the owned decision of every target, the builder's manifest left out
 * of what a task reads from the toolchain.
 *
 * @param options - The graph, the change and the targets
 * @param targets - The targets selected
 * @returns The selected tasks with their reasons and the skipped decisions
 */
function selectChange(options: PlanOptions, targets: readonly string[]): Selection {
  const selection: Selection = { selected: createMap(), skipped: [] }
  const sets = selectAffected({ ...revisions(options), targets, ignoredInputs: [TOOLCHAIN_MANIFEST_INPUT] })
  for (const target of targets) {
    const set = sets.get(target) as AffectedSet
    for (const decision of set.selected) selection.selected.set(decision.task, [...decision.reasons])
    selection.skipped.push(...set.skipped)
  }
  return selection
}

/**
 * What every selection of a change reads: the graph, the change set and the base's records.
 *
 * @param options - The options of a plan of a change
 * @returns The graph, the change set, and the graph and configuration at the base
 */
function revisions(options: PlanOptions): Omit<SelectOptions, 'targets'> {
  return {
    graph: options.graph,
    changes: options.changes as ChangeSet,
    previous: options.previous,
    previousWorkspace: options.previousWorkspace,
    previousBaseTsconfig: options.previousBaseTsconfig,
  }
}

/**
 * The builds whose output the change can alter, as a release reads them: the selection of the
 * build target with the engine that runs every task and the helpers every executor shares left
 * out, since neither shapes what a build emits. A plan of everything has no change to ship.
 *
 * @param options - The graph, the change and whether the plan is main's
 * @returns The ids of those build tasks, none off `main` or for a plan of everything
 */
function shippedBuilds(options: PlanOptions): Set<string> {
  if (!options.main || options.changes === null) return createSet()
  const builds = selectAffected({ ...revisions(options), targets: [BUILD_TARGET], ignoredInputs: [ENGINE_INPUT, EXECUTOR_SHARED_INPUT] })
  return createSet((builds.get(BUILD_TARGET) as AffectedSet).selected.map((decision) => decision.task))
}

/**
 * Adds the whole chain of every drifted library: its own targets, its e2e tasks and its publish.
 *
 * @param graph - The workspace graph
 * @param selection - The selection the chains join
 * @param targets - The targets of a chain
 * @param drift - The drifted libraries
 */
function selectDrift(graph: WorkspaceGraph, selection: Selection, targets: readonly string[], drift: readonly string[]): void {
  for (const name of drift) {
    const project = graph.projects.get(name)
    if (project === undefined || !isPublishable(project)) continue
    const manifest = project.manifest as PackageManifest
    const reason = planReason(PipelineRule.RegistryDrift, `the registry lacks ${manifest.name}@${manifest.version}`)
    for (const target of [...targets, 'publish']) {
      if (hasTarget(project, target)) select(selection, `${name}:${target}`, reason)
    }
    for (const e2e of e2eProjectsOf(graph, project)) select(selection, `${e2e.name}:e2e`, reason)
  }
}

/**
 * Whether a file defines the environment jobs.
 *
 * @param path - The workspace-relative path
 * @returns True for a pipeline workflow or a file under the actions directory
 */
function isEnvironmentJobFile(path: string): boolean {
  return ENVIRONMENT_JOB_FILES.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry))
}

/**
 * Adds the type check of the project providing hf when a change touches a file that defines the
 * environment jobs: their own steps, such as starting hf through each shell, run only on a leg that
 * has a task, and the type check is the cheapest task the sibling environments repeat.
 *
 * @param graph - The workspace graph
 * @param selection - The selection the task joins
 * @param changes - The change, or null for a plan running everything
 */
function selectEnvironmentJobs(graph: WorkspaceGraph, selection: Selection, changes: ChangeSet | null): void {
  const changed = (changes?.changes ?? []).find((change) => isEnvironmentJobFile(change.path))
  // why: the launcher is the one file of a project that only links it, so the project type checked is the one holding the source it starts
  const owner = projectOfFile(graph.projects, HF_SOURCE)
  if (changed === undefined || owner === null || !hasTarget(owner, 'typecheck')) return
  select(selection, `${owner.name}:typecheck`, {
    ...planReason(PipelineRule.EnvironmentJobs, `${changed.path} defines the environment jobs, which start ${HF_ENTRY} on every leg`),
    file: changed.path,
  })
}

/**
 * The plan of a change, or of everything.
 *
 * @param options - The graph, the change, whether publishes are planned, the targets and the drift
 * @returns The plan, its chains ranked
 */
export function createPlan(options: PlanOptions): Plan {
  const targets = [...(options.targets ?? CI_TARGETS)]
  const selectionTargets = options.main ? [...targets, 'publish'] : targets
  const selection = options.changes === null ? selectAll(options.graph, selectionTargets) : selectChange(options, selectionTargets)
  const drift = options.main ? [...(options.drift ?? [])].sort(compareText) : []
  selectDrift(options.graph, selection, targets, drift)
  selectEnvironmentJobs(options.graph, selection, options.changes)
  const railwayChanged = (options.changes?.changes ?? []).some((change) => change.path === RAILWAY_CONFIG)
  const linux = linuxTasks(options.graph, selection.selected, options.main, railwayChanged, shippedBuilds(options))
  const siblings = [Environments.Windows, Environments.MacOS].flatMap((environment) => siblingTasks(options.graph, linux, environment))
  const tasks = withNeeds(options.graph, [...linux, ...siblings])
  const chains = rankChains(options.graph, buildChains(tasks))
  const environments = [Environments.Linux, Environments.Windows, Environments.MacOS].filter((environment): environment is Environment =>
    chains.some((chain) => chain.environment === environment)
  )
  return {
    base: options.changes?.base ?? 'all',
    head: options.changes === null ? null : options.changes.head,
    mode: options.changes === null ? 'all' : 'affected',
    main: options.main,
    targets,
    drift,
    chains,
    skipped: [...selection.skipped].sort((left, right) => compareText(left.task, right.task)),
    environments,
  }
}
