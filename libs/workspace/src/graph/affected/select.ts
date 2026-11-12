/**
 * The affected analysis: for each task of the requested targets, whether the change set selects
 * it and why, with every skip resting on a named rule. A task is selected by its own changed
 * inputs, by a changed file another project owns that its closure reaches under the target's
 * edge kinds, by a tool it runs, by the configuration of a dependency whose identity changed, by a
 * global configuration file, or by a task it runs after being selected. A tool reaches the task
 * through the closure of its implementation only where the task's inputs do not name the tool's
 * project; where they do, the named files are the whole of what the task reads from it.
 *
 * @module graph/affected/select
 */

import type { Glob } from '@hyperfrontend/linter/helpers'
import type { WorkspaceGraph } from '../build'
import type { WorkspaceFile } from '../inputs'
import type { Edge, EdgePath, ProjectRecord, ToolNode } from '../model'
import type { Role } from '../roles'
import type { AffectedSet, ChangeSet, ChangeStatus, Reason, ReasonRule, TaskDecision } from '../selection'
import type { Closure, Hop } from './closure'
import type { TaskInputs } from './targets'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compileGlob } from '@hyperfrontend/linter/helpers'
import { prerequisitesOf } from '../depends-on'
import { readJson } from '../json'
import { compareText } from '../order'
import { roleOf } from '../roles'
import { ReasonRule as Rules } from '../selection'
import { hasTarget } from '../workspace'
import { ALL_KINDS, closureOf, hopTo, ruleHop, traceOf } from './closure'
import { targetResolution } from './resolution'
import {
  changedInput,
  configurationKind,
  dependentTask,
  fallback,
  globalConfig,
  isGlobalConfig,
  reached,
  reason,
  sameResolution,
  skipped,
} from './rules'
import { taskInputs } from './targets'

/** What an analysis needs. */
export interface SelectOptions {
  /** The graph at the head of the change. */
  readonly graph: WorkspaceGraph
  /** The change set. */
  readonly changes: ChangeSet
  /** The targets to decide; a target another depends on is decided as well. */
  readonly targets: readonly string[]
  /** The graph at the base of the change, which lets a deleted or renamed module name the tasks it reached. */
  readonly previous?: WorkspaceGraph
  /** The `hf.json` at the base of the change, which lets a change to it select only the tasks that resolve differently afterwards. */
  readonly previousWorkspace?: WorkspaceFile
}

/** The workspace file, whose change is judged task by task when its previous content is at hand. */
const WORKSPACE_FILE = 'hf.json'

/** One changed path. */
interface ChangedPath {
  /** The path. */
  readonly path: string
  /** What happened to it; a rename's previous path counts as deleted. */
  readonly status: ChangeStatus
  /** Whether the path is the previous path of a rename. */
  readonly renamed: boolean
}

/** What one changed file means for one task. */
interface FileDecision {
  /** Whether the file selects the task. */
  readonly selected: boolean
  /** The reason either way. */
  readonly reason: Reason
}

/** A tool implemented by a workspace project. */
interface WorkspaceTool {
  /** The executor or command. */
  readonly id: string
  /** The implementing project. */
  readonly project: string
}

/** One decision in the making. */
interface Decision {
  /** Why the task is selected; empty when it is not. */
  readonly reasons: Reason[]
  /** Why each changed file does not reach the task. */
  readonly skips: Reason[]
}

/** The prefix of a workspace-rooted input. */
const WORKSPACE_ROOT = '{workspaceRoot}/'

/** The extension a code file's specifier leaves out, and the index file a directory specifier stands for. */
const CODE_EXTENSION = /(\/index)?\.(d\.)?[cm]?[jt]sx?$/

/**
 * The stem a specifier would name a file by: the path without its code extension or index file.
 *
 * @param path - A path with or without its extension
 * @returns The path without its code extension or index file
 */
function stemOf(path: string): string {
  return path.replace(CODE_EXTENSION, '')
}

/**
 * A decision selecting the task.
 *
 * @param item - The reason
 * @returns The decision
 */
function select(item: Reason): FileDecision {
  return { selected: true, reason: item }
}

/**
 * A decision leaving the task out.
 *
 * @param item - The reason
 * @returns The decision
 */
function skip(item: Reason): FileDecision {
  return { selected: false, reason: item }
}

/**
 * The changed paths of a change set, a rename split into its deleted and added paths.
 *
 * @param changes - The change set
 * @returns The paths, sorted
 */
function changedPaths(changes: ChangeSet): ChangedPath[] {
  const paths: ChangedPath[] = []
  for (const change of changes.changes) {
    if (change.status === 'renamed') {
      paths.push(
        { path: change.previousPath as string, status: 'deleted', renamed: true },
        { path: change.path, status: 'added', renamed: false }
      )
    } else paths.push({ path: change.path, status: change.status, renamed: false })
  }
  return paths.sort((left, right) => compareText(left.path, right.path))
}

/**
 * Decides the tasks of the requested targets.
 *
 * @param options - The graph, the changes, the targets and the previous graph
 * @returns The affected set of each requested target, and of each target one of them depends on
 *
 * @example Deciding the tests to run for the working tree against `main`
 * ```typescript
 * import { changeSet, previousGraph, selectAffected, workspaceGraph } from '@hyperfrontend/workspace/graph'
 *
 * const graph = workspaceGraph(root)
 * const changes = changeSet(root, 'main', null)
 * const sets = selectAffected({ graph, changes, targets: ['test'], previous: previousGraph(root, changes) })
 * const tests = sets.get('test')!
 * tests.selected.map((decision) => decision.task) // => ['lib-features:test', 'lib-nexus:test']
 * tests.selected[0]!.reasons[0]!.rule // => 'changed-input'
 * tests.skipped[0]!.reasons[0]!.rule // => 'unreachable', every skip names the rule that makes it safe
 * ```
 *
 * @example A depended-on target is decided as well
 * ```typescript
 * // hf.json: { targetDefaults: { test: { dependsOn: ['^build'] } } }
 * [...selectAffected({ graph, changes, targets: ['test'] }).keys()] // => ['test', 'build']
 * ```
 */
export function selectAffected(options: SelectOptions): Map<string, AffectedSet> {
  const { graph, changes, previous = null, previousWorkspace } = options
  const paths = changedPaths(changes)
  const globals = paths.filter((change) => isGlobalConfig(change.path))
  // why: the file is compared only when it changed and its base content was handed over; otherwise its change selects everything, as any global configuration does
  const judged = previousWorkspace !== undefined && globals.some((change) => change.path === WORKSPACE_FILE) ? previousWorkspace : null
  // why: the file is read afresh rather than through the per-root memo, which may hold the content of another checkout of the same root
  const current = judged === null ? null : (readJson<WorkspaceFile>(join(graph.root, WORKSPACE_FILE)) ?? {})
  const deleted = createSet(
    paths.filter((change) => change.status === 'deleted' && !change.renamed).flatMap((change) => [change.path, stemOf(change.path)])
  )
  const renamed = createSet(paths.filter((change) => change.renamed).flatMap((change) => [change.path, stemOf(change.path)]))
  const closures = createMap<WorkspaceGraph, Map<string, Closure>>()
  const globs = createMap<string, Glob>()
  const tools = createMap<string, Closure>()
  const byProject = createMap<string, Edge[]>([...graph.projects.keys()].map((name) => [`project:${name}`, []]))
  for (const edge of graph.records) {
    if (edge.source.startsWith('project:')) (byProject.get(edge.source) as Edge[]).push(edge)
  }
  const results = createMap<string, AffectedSet>()
  const pending = createSet<string>()

  const globOf = (pattern: string): Glob => {
    let glob = globs.get(pattern)
    if (glob === undefined) {
      glob = compileGlob(pattern)
      globs.set(pattern, glob)
    }
    return glob
  }

  const closureFor = (of: WorkspaceGraph, project: ProjectRecord, inputs: TaskInputs, everything: boolean): Closure => {
    const memo = closures.get(of) ?? createMap<string, Closure>()
    closures.set(of, memo)
    const key = everything ? `${inputs.key}\u0000*` : inputs.key
    let closure = memo.get(key)
    if (closure === undefined) {
      const seeds = project.files.filter((file) => inputs.reach(file, roleOf(file, project.root)))
      closure = closureOf(of, seeds, everything ? ALL_KINDS : inputs.kinds)
      memo.set(key, closure)
    }
    return closure
  }

  const relabel = (rule: ReasonRule, edge: Edge | null): ReasonRule => {
    if (rule !== Rules.UnresolvedImport || edge === null || !edge.target.startsWith('file:')) return rule
    const target = edge.target.slice('file:'.length)
    return deleted.has(target) ? Rules.DeletedModule : renamed.has(target) ? Rules.RenamedModule : rule
  }

  const detailOf = (rule: ReasonRule, hop: Hop, owner: string): string => {
    // why: a collapse without an edge (a cycle, a declared dependency) always records the file that entered the project.
    const file = hop.edge === null ? (hop.from as string) : hop.edge.evidence.file
    const target = hop.edge === null ? '' : hop.edge.target.slice(hop.edge.target.indexOf(':') + 1)
    switch (rule) {
      case Rules.UnresolvedImport:
        return `${file} loads ${((hop.edge as Edge).path as EdgePath).specifier}, which names no file, so ${owner} counts whole`
      case Rules.ParseFailure:
        return `${file} does not parse, so ${owner} counts whole`
      case Rules.DeletedModule:
        return `${file} imports ${target}, which was deleted, so ${owner} counts whole`
      case Rules.RenamedModule:
        return `${file} imports ${target}, which was renamed, so ${owner} counts whole`
      case Rules.Cycle:
        return `${owner} is in a cycle with ${(graph.projectOf(file) as ProjectRecord).name}, which counts as one unit`
      case Rules.DeclaredDependency:
        return `${owner} is an implicit dependency of ${(graph.projectOf(file) as ProjectRecord).name}, which counts whole`
      case Rules.ExternalReExport:
        return `${file} re-exports ${owner} whole`
      default:
        return `${file} imports it for its side effects`
    }
  }

  const namedInput = (
    project: ProjectRecord,
    target: string,
    inputs: TaskInputs,
    change: ChangedPath,
    owner: ProjectRecord | null,
    role: Role
  ): string | null => {
    for (const input of inputs.projects) {
      if (owner !== null && owner.name === input.project && input.files(owner.root)(change.path, role))
        return `projects input naming ${input.project}`
    }
    for (const edge of byProject.get(`project:${project.name}`) as Edge[]) {
      if (edge.kind !== 'config' || !edge.targets.includes(target) || edge.evidence.kind !== 'configuration') continue
      const pattern = edge.target.startsWith('config:')
        ? edge.target.slice('config:'.length)
        : edge.path?.specifier.startsWith(WORKSPACE_ROOT) === true
          ? edge.path.specifier.slice(WORKSPACE_ROOT.length)
          : null
      if (pattern !== null && globOf(pattern).test(change.path)) return `${edge.evidence.key} in ${edge.evidence.file}`
    }
    return null
  }

  const declares = (inputs: TaskInputs, tool: ToolNode): boolean => inputs.projects.some((input) => input.project === tool.project)

  const toolsOf = (project: ProjectRecord, target: string): ToolNode[] => {
    const nodes: ToolNode[] = []
    for (const edge of byProject.get(`project:${project.name}`) as Edge[]) {
      if (edge.kind === 'tool' && edge.targets.includes(target)) nodes.push(graph.nodes.get(edge.target) as ToolNode)
    }
    return nodes
  }

  const declaredTool = (project: ProjectRecord, target: string, inputs: TaskInputs, owner: string): ToolNode | null =>
    toolsOf(project, target).find((tool) => tool.project === owner && declares(inputs, tool)) ?? null

  const toolReaching = (
    project: ProjectRecord,
    target: string,
    inputs: TaskInputs,
    change: ChangedPath,
    owner: string | null
  ): WorkspaceTool | null => {
    for (const tool of toolsOf(project, target)) {
      // why: a projects input naming the tool's project is the workspace saying which of its files the task reads; the closure of the implementation would say more
      if (tool.project === null || declares(inputs, tool)) continue
      let reach = tools.get(tool.id)
      if (reach === undefined) {
        const implementer = graph.projects.get(tool.project) as ProjectRecord
        const seeds =
          tool.entry !== null
            ? [tool.entry]
            : implementer.files.filter((file) => {
                const role = roleOf(file, implementer.root)
                return role !== 'spec' && role !== 'test-config' && role !== 'lint-config'
              })
        reach = closureOf(graph, seeds, ALL_KINDS)
        tools.set(tool.id, reach)
      }
      if (hopTo(reach, change.path, owner) !== null) return { id: tool.id, project: tool.project }
    }
    return null
  }

  const decideFile = (
    project: ProjectRecord,
    target: string,
    task: string,
    inputs: TaskInputs,
    closure: Closure,
    change: ChangedPath
  ): FileDecision => {
    const { path } = change
    const owner = graph.projectOf(path)
    const node = graph.nodes.get(`file:${path}`)
    const role = node?.kind === 'file' ? node.role : roleOf(path, owner === null ? '.' : owner.root)
    if (owner !== null && owner.name === project.name) {
      const kind = configurationKind(path, owner)
      if (kind === 'manifest')
        return select(
          reason(Rules.DependencyManifest, path, [], `${path} is the manifest of ${project.name}; every task of the project runs`)
        )
      if (kind === 'configuration')
        return select(reason(Rules.ProjectConfiguration, path, [], `${path} configures ${project.name}; every task of the project runs`))
      if (inputs.self(path, role)) return select(changedInput(path, task, `${role} file of ${project.name}`))
      return skip(skipped(Rules.RoleIrrelevant, path, task, `${role} files are not inputs of ${task}`))
    }
    const named = namedInput(project, target, inputs, change, owner, role)
    if (named !== null) return select(changedInput(path, task, named))
    const tool = toolReaching(project, target, inputs, change, owner?.name ?? null)
    if (tool !== null)
      return select(reached(Rules.ToolChanged, path, task, [`tool:${tool.id}`], `${task} runs ${tool.id}, implemented by ${tool.project}`))
    if (owner === null) return skip(skipped(Rules.Unreachable, path, task, 'no project owns the file'))
    if (inputs.dependencies === null) return skip(skipped(Rules.Unreachable, path, task, `${task} reads no dependency inputs`))
    const kind = configurationKind(path, owner)
    const touches = closure.touched.has(owner.name) || closure.projects.has(owner.name)
    if (kind === 'manifest' && touches)
      return select(
        reached(Rules.DependencyManifest, path, task, [`project:${owner.name}`], `the manifest of ${owner.name}, a dependency, changed`)
      )
    if (kind === 'configuration' && touches && change.status !== 'modified')
      return select(
        reached(
          Rules.ProjectConfiguration,
          path,
          task,
          [`project:${owner.name}`],
          `${path} was ${change.status}, which changes what ${owner.name} is`
        )
      )
    if (kind !== null)
      return skip(skipped(Rules.Unreachable, path, task, `${path} configures ${owner.name} alone; ${task} does not read it`))
    const hop = hopTo(closure, path, owner.name)
    if (hop !== null) {
      if (!inputs.dependencies(owner.root)(path, role))
        return skip(skipped(Rules.RoleIrrelevant, path, task, `${role} files of a dependency are not inputs of ${task}`))
      const ruled = closure.files.has(path) ? ruleHop(closure, path) : hop
      // why: a hop found by its rule, or the collapse of a project, always carries a rule.
      const rule = ruled === null ? Rules.ReachableFromEntry : relabel(ruled.rule as ReasonRule, ruled.edge)
      return select(
        reached(
          rule,
          path,
          task,
          traceOf(closure, path),
          ruled === null ? 'it is in the closure of the files the task reads' : detailOf(rule, ruled, owner.name)
        )
      )
    }
    if (previous !== null && change.status === 'deleted') {
      const before = previous.projects.get(project.name)
      if (before !== undefined && hasTarget(before, target)) {
        const old = closureFor(previous, before, taskInputs(previous.root, before, target), false)
        if (old.files.has(path)) {
          const rule = change.renamed ? Rules.RenamedModule : Rules.DeletedModule
          return select(reached(rule, path, task, traceOf(old, path), `it was in the closure of the files ${task} read before the change`))
        }
      }
    }
    if (hopTo(closureFor(graph, project, inputs, true), path, owner.name) !== null)
      return skip(skipped(Rules.KindIrrelevant, path, task, `reachable only through type-only imports, which ${target} does not follow`))
    // why: a project with no edges at all, such as a hand-written tool project nothing lints, has no group entry
    const groups = (graph.groups.get(project.name) ?? []).filter((group) => group.target === `project:${owner.name}`)
    const declared = declaredTool(project, target, inputs, owner.name)
    const through =
      declared !== null
        ? `${task} runs ${declared.id}, reading from ${owner.name} only the files its projects input names`
        : groups.length === 0
          ? `${project.name} does not depend on ${owner.name}`
          : `${project.name} depends on ${owner.name} only through ${groups.map((group) => `${group.kind} ${group.role} (${group.files.length} file${group.files.length === 1 ? '' : 's'})`).join(', ')}`
    return skip(skipped(Rules.Unreachable, path, task, `${path} is not reachable from the files ${task} reads; ${through}`))
  }

  const fallbackReason = (edge: Edge, rule: ReasonRule, project: string): Reason => {
    const labelled = relabel(rule, edge)
    return fallback(
      labelled,
      edge.evidence.file,
      [edge.source, edge.target],
      detailOf(labelled, { from: null, edge, rule: labelled }, project)
    )
  }

  const decide = (target: string): AffectedSet | null => {
    const known = results.get(target)
    if (known !== undefined) return known
    if (pending.has(target)) return null
    pending.add(target)
    const projects = [...graph.projects.values()]
      .filter((project) => hasTarget(project, target))
      .sort((left, right) => compareText(left.name, right.name))
    const decisions = createMap<string, Decision>()
    const fallbacks = createMap<string, Reason>()
    for (const project of projects) {
      const task = `${project.name}:${target}`
      const inputs = taskInputs(graph.root, project, target)
      const closure = closureFor(graph, project, inputs, false)
      const unchanged =
        judged !== null && current !== null && targetResolution(judged, project, target) === targetResolution(current, project, target)
      const decision: Decision = { reasons: [], skips: [] }
      for (const change of globals) {
        if (change.path !== WORKSPACE_FILE || !unchanged) {
          decision.reasons.push(globalConfig(change.path, task))
          continue
        }
        // why: judged, the file keeps its ordinary standing as a file of the root project, so a task that names it among its inputs is still selected
        const outcome = decideFile(project, target, task, inputs, closure, change)
        if (outcome.selected) decision.reasons.push(outcome.reason)
        else decision.skips.push(sameResolution(change.path, task))
      }
      for (const change of paths) {
        if (isGlobalConfig(change.path)) continue
        const outcome = decideFile(project, target, task, inputs, closure, change)
        ;(outcome.selected ? decision.reasons : decision.skips).push(outcome.reason)
      }
      for (const met of closure.fallbacks) {
        const record = fallbackReason(met.edge, met.rule, met.project)
        fallbacks.set(`${record.rule} ${record.path.join(' ')}`, record)
      }
      decisions.set(task, decision)
    }
    for (let settled = false; !settled; ) {
      settled = true
      for (const project of projects) {
        const task = `${project.name}:${target}`
        const decision = decisions.get(task) as Decision
        for (const dependency of prerequisitesOf(graph, project, target)) {
          if (decision.reasons.some((item) => item.rule === Rules.DependentTask && item.path[0] === `task:${dependency.id}`)) continue
          const selected =
            dependency.target === target
              ? (decisions.get(dependency.id) as Decision).reasons.length > 0
              : (decide(dependency.target)?.selected.some((item) => item.task === dependency.id) ?? false)
          if (selected) {
            decision.reasons.push(dependentTask(task, dependency.id))
            settled = false
          }
        }
      }
    }
    pending.delete(target)
    const toDecision = ([task, decision]: readonly [string, Decision], selected: boolean): TaskDecision => ({
      task,
      reasons: selected ? decision.reasons : decision.skips,
    })
    const set: AffectedSet = {
      target,
      changes,
      selected: [...decisions].filter(([, decision]) => decision.reasons.length > 0).map((item) => toDecision(item, true)),
      skipped: [...decisions].filter(([, decision]) => decision.reasons.length === 0).map((item) => toDecision(item, false)),
      fallbacks: [...fallbacks.values()].sort(
        (left, right) => compareText(left.rule, right.rule) || compareText(left.file as string, right.file as string)
      ),
    }
    results.set(target, set)
    return set
  }

  for (const target of options.targets) decide(target)
  return results
}
