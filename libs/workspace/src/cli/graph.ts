/**
 * The `graph` command: prints and persists the owned workspace graph. `npx hf graph <command>`,
 * where the command is `projects [--json]`, `graph [--json]`, `explain <project>`,
 * `explain <project:target> [--base <ref>] [--head <ref>]`, `build [--force]`, `verify`,
 * `status [--json]` or `affected --target <target> [--base <ref>] [--head <ref>] [--json|--explain]`.
 *
 * @module cli/graph
 */

import type { WorkspaceGraph } from '../graph/build'
import type { EdgeGroup, ProjectRecord } from '../graph/model'
import type { AffectedSet } from '../graph/selection'
import { parseArgs } from 'node:util'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { formatAffected, formatTask } from '../graph/affected/explain'
import { selectAffected } from '../graph/affected/select'
import { workspaceGraph } from '../graph/build'
import { changeSet, DEFAULT_BASE, resolveBase } from '../graph/changes'
import { compareText } from '../graph/order'
import { previousGraph, previousWorkspaceFile } from '../graph/revision'
import { printableProject } from '../graph/store/serialize'
import { buildState, stateStatus, verifyState } from '../graph/store/state'
import { refusal } from '../runner/refusal'

/** How many files a group lists before it counts the rest. */
const LISTED_FILES = 3

/** What the command expects. */
export const GRAPH_USAGE =
  'usage: hf graph projects [--json] | graph [--json] | explain <project|project:target> | build [--force] | verify | status [--json] | affected --target <target> [--base <ref>] [--head <ref>] [--json|--explain]'

/** Where the command writes. */
export interface GraphOutput {
  /** Writes a line of the result, to standard output. */
  readonly say: (line: string) => void
  /** Writes a line about what the command did on the way, to standard error. */
  readonly note: (line: string) => void
}

/** The revisions a selection compares. */
interface Revisions {
  /** The base revision. */
  readonly base: string
  /** The head revision, or null for the working tree. */
  readonly head: string | null
}

/**
 * One line describing a group of edges.
 *
 * @param group - The group of edges described
 * @returns The kind, role, count and first files
 */
function describeGroup(group: EdgeGroup): string {
  const listed = group.files.slice(0, LISTED_FILES).join(', ')
  const rest = group.files.length > LISTED_FILES ? `, +${group.files.length - LISTED_FILES} more` : ''
  return `${group.kind} ${group.role} (${group.files.length} file${group.files.length === 1 ? '' : 's'}): ${listed}${rest}`
}

/**
 * The groups by one of their ends, each group as one line under that end.
 *
 * @param groups - The groups, all with the same source or the same target
 * @param by - Which end of the group heads a block
 * @returns A heading line per end, its groups indented under it
 */
function groupLines(groups: readonly EdgeGroup[], by: 'target' | 'source'): string[] {
  const blocks = createMap<string, EdgeGroup[]>()
  for (const group of groups) blocks.set(group[by], [...(blocks.get(group[by]) ?? []), group])
  return [...blocks]
    .sort(([left], [right]) => compareText(left, right))
    .flatMap(([head, own]) => [`  ${by === 'target' ? '→' : '←'} ${head}`, ...own.map((group) => `      ${describeGroup(group)}`)])
}

/**
 * What a project depends on and what depends on it.
 *
 * @param graph - The workspace graph the project belongs to
 * @param name - Which project to describe
 * @returns Its name and place, then what it depends on and what depends on it
 * @throws {Error} When no project has the name
 */
function projectLines(graph: WorkspaceGraph, name: string): string[] {
  const project = graph.projects.get(name)
  if (project === undefined) throw refusal(`no project named ${name}`)
  return [
    `${project.name} (${project.type}, ${project.root})`,
    'depends on',
    ...groupLines(graph.groups.get(project.name) ?? [], 'target'),
    'depended on by',
    ...groupLines(
      [...graph.groups.values()].flat().filter((group) => group.target === `project:${project.name}`),
      'source'
    ),
  ]
}

/**
 * Builds the persisted state, reports what the build did and returns the graph.
 *
 * @param root - The workspace root, absolute
 * @param force - Whether to build cold
 * @param report - Where the report goes
 * @returns The graph the state describes
 */
function build(root: string, force: boolean, report: (line: string) => void): WorkspaceGraph {
  const { graph, outcome } = buildState(root, { force })
  const { plan } = outcome
  const written = outcome.written.length === 0 ? 'nothing written' : `wrote ${outcome.written.join(', ')}`
  report(
    `graph state ${plan.mode} (${plan.reasons.join(', ')}): ${plan.reparse.length} files parsed, ${written}, ${round(outcome.durationMs)} ms`
  )
  return graph
}

/**
 * The affected set of a target between two revisions.
 *
 * @param root - The workspace root, absolute
 * @param graph - The graph at the head
 * @param target - The target whose tasks are decided
 * @param revisions - The base and the head
 * @returns The affected set
 */
function affected(root: string, graph: WorkspaceGraph, target: string, revisions: Revisions): AffectedSet {
  const changes = changeSet(root, verifiedBase(root, revisions.base), revisions.head)
  const sets = selectAffected({
    graph,
    changes,
    targets: [target],
    previous: previousGraph(root, changes),
    previousWorkspace: previousWorkspaceFile(root, changes),
  })
  return sets.get(target) as AffectedSet
}

/**
 * The projects of a graph in name order.
 *
 * @param graph - The graph whose projects are listed
 * @returns Every project, ordered by name
 */
function sortedProjects(graph: WorkspaceGraph): ProjectRecord[] {
  return [...graph.projects.values()].sort((left, right) => compareText(left.name, right.name))
}

/**
 * The base revision a comparison runs from, once the repository is known to have it.
 *
 * @param root - The workspace root, absolute
 * @param base - The base as written, or the default
 * @returns The revision git resolves: the base, or `main` for a default base in a repository with no `origin/main`
 * @throws {Error} A refusal naming the revision the repository lacks and how to name another
 *
 * @example The default in a repository that was never pushed
 * ```typescript
 * verifiedBase(root, 'origin/main') // => 'main'
 * verifiedBase(root, 'v1.2.0') // throws: no revision v1.2.0 in this repository: name the base with --base=<ref>
 * ```
 */
export function verifiedBase(root: string, base: string): string {
  const revision = resolveBase(root, base)
  if (revision !== null) return revision
  const lacking = base === DEFAULT_BASE ? `neither ${DEFAULT_BASE} nor main` : `no revision ${base}`
  throw refusal(`${lacking} in this repository: commit first, or name the base with --base=<ref>`)
}

/**
 * Reads the arguments of the graph command, refusing a flag it does not know.
 *
 * @param argv - The arguments after `graph`
 * @returns The flags and the positional arguments
 */
function readArguments(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      options: {
        json: { type: 'boolean', default: false },
        explain: { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
        target: { type: 'string' },
        base: { type: 'string', default: DEFAULT_BASE },
        head: { type: 'string' },
      },
      allowPositionals: true,
    })
  } catch (error) {
    throw refusal((error as Error).message)
  }
}

/**
 * Runs the `graph` command.
 *
 * @param argv - The arguments after `graph`
 * @param root - The workspace root, absolute
 * @param output - Where the command writes
 * @returns The exit code: 1 when `verify` finds a difference, 0 otherwise
 * @throws {Error} When the command or one of its arguments is not one it knows
 *
 * @example The tasks a change selects, explained
 * ```typescript
 * import { runGraph } from '@hyperfrontend/workspace/cli'
 *
 * const output = { say: (line: string) => process.stdout.write(`${line}\n`), note: (line: string) => process.stderr.write(`${line}\n`) }
 * runGraph(['affected', '--target', 'build', '--base', 'origin/main', '--explain'], root, output)
 * // => 0; each selected build and the file that selected it went to `say`, the state build report to `note`
 * ```
 *
 * @example Checking the persisted graph state in CI
 * ```typescript
 * runGraph(['verify'], root, output) // => 1 when a cold build disagrees with the state on disk
 * ```
 */
export function runGraph(argv: readonly string[], root: string, output: GraphOutput): number {
  const { say, note } = output
  const { values, positionals } = readArguments(argv)
  const revisions: Revisions = { base: values.base, head: values.head ?? null }
  const [command, argument] = positionals
  if (command === 'projects') {
    const projects = sortedProjects(workspaceGraph(root))
    if (values.json) say(stringify(projects.map(printableProject), null, 2))
    else for (const project of projects) say(`${project.name}\t${project.type}\t${project.root}\t${project.tags.join(',')}`)
  } else if (command === 'graph') {
    const graph = workspaceGraph(root)
    const projects = sortedProjects(graph)
    if (values.json)
      say(stringify({ projects: projects.map(printableProject), nodes: [...graph.nodes.values()], edges: graph.records }, null, 2))
    else {
      const kinds = createMap<string, number>()
      for (const node of graph.nodes.values()) kinds.set(node.kind, (kinds.get(node.kind) ?? 0) + 1)
      say(`${projects.length} projects, ${graph.nodes.size} nodes, ${graph.records.length} edges`)
      for (const [kind, count] of kinds) say(`  ${kind}: ${count}`)
    }
  } else if (command === 'explain' && argument !== undefined) {
    const colon = argument.indexOf(':')
    const lines =
      colon === -1
        ? projectLines(workspaceGraph(root), argument)
        : formatTask(affected(root, build(root, values.force, note), argument.slice(colon + 1), revisions), argument)
    for (const line of lines) say(line)
  } else if (command === 'build') {
    build(root, values.force, say)
  } else if (command === 'verify') {
    const verification = verifyState(root)
    say(
      verification.ok
        ? 'graph state verified: a cold build agrees byte for byte'
        : `graph state differs from a cold build: ${verification.differences.join(', ')}`
    )
    return verification.ok ? 0 : 1
  } else if (command === 'status') {
    const status = stateStatus(root)
    if (values.json) say(stringify(status, null, 2))
    else {
      say(
        status.meta === null
          ? 'no graph state'
          : `graph state present (${status.meta.algorithm.slice(0, 12)}, reader ${status.meta.reader})`
      )
      say(`next build: ${status.plan.mode} (${status.plan.reasons.join(', ')}), ${status.plan.reparse} files to parse`)
      for (const [name, digest] of entries(status.digests ?? {})) say(`  ${name} ${digest}`)
    }
  } else if (command === 'affected') {
    if (values.target === undefined) throw refusal('affected needs --target <target>')
    const set = affected(root, build(root, values.force, note), values.target, revisions)
    if (values.json) say(stringify(set, null, 2))
    else for (const line of formatAffected(set, values.explain ? 'explain' : 'tasks')) say(line)
  } else {
    throw refusal(`unknown command ${command ?? ''}`)
  }
  return 0
}
