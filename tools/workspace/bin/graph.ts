/**
 * Prints and persists the owned workspace graph. Usage, from the workspace root:
 * `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/graph.ts <command>`, or
 * `npm run hf -- graph <command>`, where the command is `projects [--json]`,
 * `graph [--json]`, `explain <project>`, `explain <project:target> [--base <ref>] [--head <ref>]`,
 * `build [--force]`, `verify`, `status [--json]` or
 * `affected --target <target> [--base <ref>] [--head <ref>] [--json|--explain]`.
 *
 * @module bin/graph
 */

import type { WorkspaceGraph } from '../src/graph/build'
import type { EdgeGroup } from '../src/graph/model'
import type { AffectedSet } from '../src/graph/selection'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { findUpwardWhere } from '@hyperfrontend/project-scope/core'
import { formatAffected, formatTask } from '../src/graph/affected/explain'
import { selectAffected } from '../src/graph/affected/select'
import { workspaceGraph } from '../src/graph/build'
import { changeSet } from '../src/graph/changes'
import { compareText } from '../src/graph/order'
import { previousGraph } from '../src/graph/revision'
import { printableProject } from '../src/graph/store/serialize'
import { buildState, stateStatus, verifyState } from '../src/graph/store/state'

/** How many files a group lists before it counts the rest. */
const LISTED_FILES = 3

/** The usage line. */
const USAGE =
  'expected projects [--json], graph [--json], explain <project|project:target>, build [--force], verify, status [--json] or affected --target <target> [--base <ref>] [--head <ref>] [--json|--explain]'

const { values, positionals } = parseArgs({
  options: {
    json: { type: 'boolean', default: false },
    explain: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    target: { type: 'string' },
    base: { type: 'string', default: 'main' },
    head: { type: 'string' },
  },
  allowPositionals: true,
})
const root = findUpwardWhere(process.cwd(), (directory) => existsSync(join(directory, 'nx.json')))
if (root === null) throw createError('run from inside the workspace: no nx.json above the working directory')
const [command, argument] = positionals

/**
 * Writes a line to standard output.
 *
 * @param line - The text, without its newline
 */
function say(line: string): void {
  process.stdout.write(`${line}\n`)
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
 * Prints the groups by target, each group as one line under its target.
 *
 * @param groups - The groups, all with the same source or the same target
 * @param by - Which end of the group heads a block
 */
function printGroups(groups: readonly EdgeGroup[], by: 'target' | 'source'): void {
  const blocks = createMap<string, EdgeGroup[]>()
  for (const group of groups) blocks.set(group[by], [...(blocks.get(group[by]) ?? []), group])
  for (const [head, own] of [...blocks].sort(([left], [right]) => compareText(left, right))) {
    say(`  ${by === 'target' ? '→' : '←'} ${head}`)
    for (const group of own) say(`      ${describeGroup(group)}`)
  }
}

/**
 * Prints what a project depends on and what depends on it.
 *
 * @param graph - The workspace graph the project belongs to
 * @param name - Which project to describe
 */
function explainProject(graph: WorkspaceGraph, name: string): void {
  const project = graph.projects.get(name)
  if (project === undefined) throw createError(`no project named ${name}`)
  say(`${project.name} (${project.type}, ${project.root})`)
  say('depends on')
  printGroups(graph.groups.get(project.name) ?? [], 'target')
  say('depended on by')
  printGroups(
    [...graph.groups.values()].flat().filter((group) => group.target === `project:${project.name}`),
    'source'
  )
}

/**
 * Builds the persisted state, reports what the build did and returns the graph.
 *
 * @param force - Whether to build cold
 * @param report - Where the report goes: standard error unless it is the command's result, so standard output carries only the result
 * @returns The graph the state describes
 */
function build(force: boolean, report: (line: string) => void = (line) => process.stderr.write(`${line}\n`)): WorkspaceGraph {
  const { graph, outcome } = buildState(root as string, { force })
  const { plan } = outcome
  const written = outcome.written.length === 0 ? 'nothing written' : `wrote ${outcome.written.join(', ')}`
  report(
    `graph state ${plan.mode} (${plan.reasons.join(', ')}): ${plan.reparse.length} files parsed, ${written}, ${round(outcome.durationMs)} ms`
  )
  return graph
}

/**
 * The affected set of a target between the base and the head given on the command line.
 *
 * @param graph - The graph at the head
 * @param target - The target whose tasks are decided
 * @returns The affected set
 */
function affected(graph: WorkspaceGraph, target: string): AffectedSet {
  const changes = changeSet(root as string, values.base, values.head ?? null)
  const sets = selectAffected({ graph, changes, targets: [target], previous: previousGraph(root as string, changes) })
  return sets.get(target) as AffectedSet
}

if (command === 'projects') {
  const projects = [...workspaceGraph(root).projects.values()].sort((left, right) => compareText(left.name, right.name))
  if (values.json) say(stringify(projects.map(printableProject), null, 2))
  else for (const project of projects) say(`${project.name}\t${project.type}\t${project.root}\t${project.tags.join(',')}`)
} else if (command === 'graph') {
  const graph = workspaceGraph(root)
  const projects = [...graph.projects.values()].sort((left, right) => compareText(left.name, right.name))
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
  if (colon === -1) explainProject(workspaceGraph(root), argument)
  else for (const line of formatTask(affected(build(values.force), argument.slice(colon + 1)), argument)) say(line)
} else if (command === 'build') {
  build(values.force, say)
} else if (command === 'verify') {
  const verification = verifyState(root)
  say(
    verification.ok
      ? 'graph state verified: a cold build agrees byte for byte'
      : `graph state differs from a cold build: ${verification.differences.join(', ')}`
  )
  process.exitCode = verification.ok ? 0 : 1
} else if (command === 'status') {
  const status = stateStatus(root)
  if (values.json) say(stringify(status, null, 2))
  else {
    say(
      status.present
        ? `graph state present (${status.meta?.algorithm.slice(0, 12) ?? ''}, reader ${status.meta?.reader ?? ''})`
        : 'no graph state'
    )
    say(`next build: ${status.plan.mode} (${status.plan.reasons.join(', ')}), ${status.plan.reparse} files to parse`)
    for (const [name, digest] of entries(status.digests ?? {})) say(`  ${name} ${digest}`)
  }
} else if (command === 'affected') {
  if (values.target === undefined) throw createError('affected needs --target <target>')
  const set = affected(build(values.force), values.target)
  if (values.json) say(stringify(set, null, 2))
  else for (const line of formatAffected(set, values.explain ? 'explain' : 'tasks')) say(line)
} else {
  throw createError(`unknown command ${command ?? ''}: ${USAGE}`)
}
