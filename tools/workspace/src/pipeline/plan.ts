/**
 * The plan of a change: the owned selection of every pipeline target, the tasks the pipeline adds
 * (every task a planned task needs first, the probes and smokes after the builds, and on `main`
 * the deploys and the provision they wait on), the
 * registry drift of `main`, and the chains the two environments run, ranked for the scheduler.
 *
 * @module pipeline/plan
 */

import type { WorkspaceGraph } from '../graph/build'
import type { PackageManifest } from '../graph/model'
import type { AffectedSet, ChangeSet } from '../graph/selection'
import type { Environment, Plan, PlanReason, SkippedTask } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { selectAffected } from '../graph/affected/select'
import { compareText } from '../graph/order'
import { hasTarget } from '../graph/workspace'
import { RAILWAY_CONFIG } from './commands'
import { buildChains, e2eProjectsOf, isPublishable, linuxTasks, siblingTasks, withNeeds } from './fold'
import { Environment as Environments, PipelineRule, planReason } from './model'
import { rankChains } from './order'

/** The targets the pipeline selects on every change. */
export const CI_TARGETS = freeze(['typecheck', 'lint', 'test', 'build', 'e2e'] as const)

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
 * The selection of a change: the owned decision of every target.
 *
 * @param options - The graph, the change and the targets
 * @param targets - The targets selected
 * @returns The selected tasks with their reasons and the skipped decisions
 */
function selectChange(options: PlanOptions, targets: readonly string[]): Selection {
  const { graph } = options
  const changes = options.changes as ChangeSet
  const selection: Selection = { selected: createMap(), skipped: [] }
  const sets = selectAffected({ graph, changes, targets, previous: options.previous })
  for (const target of targets) {
    const set = sets.get(target) as AffectedSet
    for (const decision of set.selected) selection.selected.set(decision.task, [...decision.reasons])
    selection.skipped.push(...set.skipped)
  }
  return selection
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
  const railwayChanged = (options.changes?.changes ?? []).some((change) => change.path === RAILWAY_CONFIG)
  const linux = linuxTasks(options.graph, selection.selected, options.main, railwayChanged)
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
