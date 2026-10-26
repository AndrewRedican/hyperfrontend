/**
 * Reads the project graph the way Nx computes it, through `nx graph --file`, as the baseline the
 * owned graph is compared against.
 *
 * @module adapters/read-graph
 */

import type { ProjectGraph } from '../compat'
import type { NxCommandRunner } from './run-nx'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** The file `nx graph --file` writes, as far as it is read. */
interface NxGraphFile {
  /** The project graph. */
  readonly graph?: ProjectGraph
}

/** Where the graph file is written. */
export interface ReadGraphOptions {
  /** The directory the temporary graph file is created under; the system temporary directory by default. */
  readonly tempRoot?: string
}

/**
 * The project graph as Nx computes it for a checkout.
 *
 * @param run - A runner for the checkout's Nx
 * @param options - Where the temporary graph file goes
 * @returns The graph with its nodes, external nodes and dependencies
 * @throws {Error} When Nx writes no graph
 *
 * @example Counting Nx's edges
 * ```typescript
 * const graph = readNxGraph(nxRunner(checkout))
 * const edges = values(graph.dependencies).reduce((total, list) => total + list.length, 0)
 * ```
 */
export function readNxGraph(run: NxCommandRunner, options: ReadGraphOptions = {}): ProjectGraph {
  const directory = mkdtempSync(join(options.tempRoot ?? tmpdir(), 'nx-graph-'))
  try {
    const file = join(directory, 'graph.json')
    run(['graph', `--file=${file}`])
    const graph = (parse(readFileSync(file, 'utf8')) as NxGraphFile).graph
    if (graph === undefined) throw createError('nx graph --file wrote a file without a graph')
    return graph
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
