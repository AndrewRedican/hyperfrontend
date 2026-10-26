/**
 * What a persisted state was written by and from: the schema, the algorithm (a hash of the graph
 * sources where the workspace aliases them), the import reader, the Node major, and the hashes of
 * the files whose change invalidates the whole graph.
 *
 * @module graph/store/meta
 */

import type { FileRecord } from './files'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { freeze, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readerVersion } from '../imports'
import { readAliases } from '../workspace'
import { hashesByPath } from './files'
import { sourcesHash } from './hashes'

/** The shape of the state files; raised when any body's shape changes. */
export const SCHEMA = 'hf-graph/1'

/** The files whose change invalidates the whole graph: aliases, externals, inputs. */
export const GLOBAL_CONFIG = freeze(['nx.json', 'package.json', 'package-lock.json', 'tsconfig.base.json'] as const)

/** The alias naming the graph package, whose sources decide the algorithm where a workspace runs it from source. */
const GRAPH_ALIAS = '@hyperfrontend/workspace/graph'

/** What a state was written by and from. */
export interface GraphMeta {
  /** The schema of the state files. */
  readonly schema: string
  /** The algorithm that wrote the state: a hash of the graph sources, or `installed`. */
  readonly algorithm: string
  /** The import reader, as `readerVersion` names it. */
  readonly reader: string
  /** The Node major the state was written on, kept because the parser can differ. */
  readonly node: string
  /** The hash of each global configuration file, null for one the workspace lacks. */
  readonly config: Readonly<Record<string, string | null>>
}

/**
 * The algorithm that builds the graph for a workspace: a hash of the graph sources where the
 * workspace aliases the graph package to its source, else `installed`.
 *
 * @param root - The workspace root, absolute
 * @returns The algorithm's name
 */
export function algorithmVersion(root: string): string {
  const target = readAliases(root).get(GRAPH_ALIAS)?.[0]
  const sources = target === undefined ? null : join(root, dirname(target))
  return sources !== null && existsSync(sources) ? sourcesHash(sources) : 'installed'
}

/**
 * The meta of a state written now from the given files.
 *
 * @param root - The workspace root, absolute
 * @param files - The workspace's files with their hashes
 * @returns What a state written now is written by and from
 */
export function currentMeta(root: string, files: readonly FileRecord[]): GraphMeta {
  const hashes = hashesByPath(files)
  return {
    schema: SCHEMA,
    algorithm: algorithmVersion(root),
    reader: readerVersion(root),
    node: process.versions.node.split('.')[0] as string,
    config: fromEntries(GLOBAL_CONFIG.map((file) => [file, hashes.get(file) ?? null])),
  }
}

/**
 * What differs between the meta of a persisted state and the current one.
 *
 * @param previous - The persisted meta
 * @param current - The meta a build would write now
 * @returns The differing keys, configuration files as `config:<file>`; empty when they agree
 */
export function metaDifferences(previous: GraphMeta, current: GraphMeta): string[] {
  const differences: string[] = []
  for (const key of ['schema', 'algorithm', 'reader', 'node'] as const) if (previous[key] !== current[key]) differences.push(key)
  for (const file of GLOBAL_CONFIG) if (previous.config[file] !== current.config[file]) differences.push(`config:${file}`)
  return differences
}
