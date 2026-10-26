/**
 * Prints the owned workspace graph. Usage, from the workspace root:
 * `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/graph.ts <command>`, or
 * `npx nx run tool-workspace:graph -- <command>`, where the command is `projects [--json]`,
 * `graph [--json]` or `explain <project>`.
 *
 * @module bin/graph
 */

import type { EdgeGroup, ProjectRecord } from '../src/graph/model'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { findUpwardWhere } from '@hyperfrontend/project-scope/core'
import { workspaceGraph } from '../src/graph/build'
import { compareText } from '../src/graph/order'

/** How many files a group lists before it counts the rest. */
const LISTED_FILES = 3

const { values, positionals } = parseArgs({ options: { json: { type: 'boolean', default: false } }, allowPositionals: true })
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
 * A project as the JSON forms print it: the record without its manifest and configuration.
 *
 * @param project - The project whose fields are printed
 * @returns The printable fields
 */
function printable(project: ProjectRecord): Omit<ProjectRecord, 'manifest' | 'configuration'> {
  const { name, root: projectRoot, type, tags, implicitDependencies, files } = project
  return { name, root: projectRoot, type, tags, implicitDependencies, files }
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

const graph = workspaceGraph(root)
const projects = [...graph.projects.values()].sort((left, right) => compareText(left.name, right.name))

if (command === 'projects') {
  if (values.json) say(stringify(projects.map(printable), null, 2))
  else for (const project of projects) say(`${project.name}\t${project.type}\t${project.root}\t${project.tags.join(',')}`)
} else if (command === 'graph') {
  if (values.json) say(stringify({ projects: projects.map(printable), nodes: [...graph.nodes.values()], edges: graph.records }, null, 2))
  else {
    const kinds = createMap<string, number>()
    for (const node of graph.nodes.values()) kinds.set(node.kind, (kinds.get(node.kind) ?? 0) + 1)
    say(`${projects.length} projects, ${graph.nodes.size} nodes, ${graph.records.length} edges`)
    for (const [kind, count] of kinds) say(`  ${kind}: ${count}`)
  }
} else if (command === 'explain' && argument !== undefined) {
  const project = graph.projects.get(argument)
  if (project === undefined) throw createError(`no project named ${argument}`)
  say(`${project.name} (${project.type}, ${project.root})`)
  say('depends on')
  printGroups(graph.groups.get(project.name) ?? [], 'target')
  say('depended on by')
  printGroups(
    [...graph.groups.values()].flat().filter((group) => group.target === `project:${project.name}`),
    'source'
  )
} else {
  throw createError(`unknown command ${command ?? ''}: expected projects [--json], graph [--json] or explain <project>`)
}
