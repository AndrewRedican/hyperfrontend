/**
 * The graph oracle: both graphs written out as one line per project and per edge, compared as sets.
 *
 * @module scripts/lib/graph-oracle-main
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { buildGraph } from '../../src/graph/build.ts'
import { WORKSPACE_ROOT, labelDir, say } from './paths.ts'

/** The project data of a captured node. */
interface CapturedData {
  /** The project root. */
  readonly root: string
  /** The tags. */
  readonly tags?: readonly string[]
  /** The declared dependencies. */
  readonly implicitDependencies?: readonly string[]
}

/** A captured node. */
interface CapturedNode {
  /** The project type. */
  readonly type: string
  /** The project data. */
  readonly data: CapturedData
}

/** A captured edge. */
interface CapturedEdge {
  /** The depending project. */
  readonly source: string
  /** The project depended on. */
  readonly target: string
  /** The edge type. */
  readonly type: string
}

/** The captured graph. */
interface CapturedProjects {
  /** The nodes by project name. */
  readonly nodes: Readonly<Record<string, CapturedNode>>
  /** The edges by source project. */
  readonly dependencies: Readonly<Record<string, readonly CapturedEdge[]>>
}

/** The captured graph file. */
interface CapturedGraph {
  /** The graph. */
  readonly graph: CapturedProjects
}

/**
 * Runs the oracle.
 *
 * @param argv - The arguments after the script's path
 */
export async function main(argv: readonly string[]): Promise<void> {
  const at = argv.indexOf('--corpus')
  const label = at === -1 ? 'o0' : (argv[at + 1] ?? 'o0')
  const file = argv.indexOf('--graph')
  const captured = (
    parse(readFileSync(file === -1 ? join(labelDir(label), 'nx-graph.json') : (argv[file + 1] as string), 'utf8')) as CapturedGraph
  ).graph
  const started = performance.now()
  const graph = buildGraph(WORKSPACE_ROOT)
  const expected = createSet<string>()
  const actual = createSet<string>()
  for (const [name, node] of entries(captured.nodes)) {
    expected.add(
      `P ${name} ${node.type} ${node.data.root} tags=${(node.data.tags ?? []).join(',')} implicit=${(node.data.implicitDependencies ?? []).join(',')}`
    )
  }
  for (const edges of values(captured.dependencies))
    for (const edge of edges) expected.add(`E ${edge.source} -> ${edge.target} ${edge.type}`)
  for (const project of graph.projects.values()) {
    actual.add(
      `P ${project.name} ${project.type} ${project.root} tags=${project.tags.join(',')} implicit=${project.implicitDependencies.join(',')}`
    )
  }
  const edgeFiles = createMap<string, readonly string[]>()
  for (const edges of graph.edges.values()) {
    for (const edge of edges) {
      const line = `E ${edge.source} -> ${edge.target} ${edge.type}`
      actual.add(line)
      edgeFiles.set(line, edge.files)
    }
  }
  const missing = [...expected].filter((line) => !actual.has(line))
  const extra = [...actual].filter((line) => !expected.has(line))
  for (const line of missing.slice(0, 40)) say(`missing  ${line}`)
  for (const line of extra.slice(0, 40)) say(`extra    ${line} ${(edgeFiles.get(line) ?? []).slice(0, 2).join(' ')}`)
  say(
    `${missing.length} missing, ${extra.length} extra, ${graph.projects.size} projects, ${[...graph.edges.values()].flat().length} edges in ${((performance.now() - started) / 1000).toFixed(1)} s`
  )
  if (missing.length + extra.length > 0) process.exitCode = 1
}
