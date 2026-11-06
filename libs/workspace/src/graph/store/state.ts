/**
 * The persisted graph state under `.hf/graph/`: five files (`files`, `imports`, `graph`,
 * `entries`, `meta`) built from the working tree, reused where nothing changed, rewritten only
 * where their bytes differ, and verified by a cold rebuild compared byte for byte.
 *
 * @module graph/store/state
 */

import type { WorkspaceGraph } from '../build'
import type { FileImport } from '../model'
import type { FileRecord } from './files'
import type { UpdatePlan } from './invalidate'
import type { GraphMeta } from './meta'
import type { EntryClosure, GraphBody, ImportRecord } from './serialize'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries, freeze, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { buildGraph } from '../build'
import { readImports } from '../imports'
import { hashesByPath, listFileRecords } from './files'
import { digestOf } from './hashes'
import { planUpdate } from './invalidate'
import { withLock } from './lock'
import { currentMeta } from './meta'
import { readStateFile } from './read'
import { entriesBody, graphBody, importsBody } from './serialize'
import { envelopeText, writeStateFile } from './write'

/** What the files state file holds. */
export interface FilesBody {
  /** Every file with its hash, sorted by path. */
  readonly files: readonly FileRecord[]
}

/** What the imports state file holds. */
export interface ImportsBody {
  /** The import record of each code file, by path. */
  readonly files: Readonly<Record<string, ImportRecord>>
}

/** What the entries state file holds. */
export interface EntriesBody {
  /** Each entry's closure, by entry id. */
  readonly entries: Readonly<Record<string, EntryClosure>>
}

/** The whole persisted state. */
export interface PersistedState {
  /** The files and their hashes. */
  readonly files: FilesBody
  /** The imports by path. */
  readonly imports: ImportsBody
  /** The graph. */
  readonly graph: GraphBody
  /** The entry closures. */
  readonly entries: EntriesBody
  /** What wrote the state and from what. */
  readonly meta: GraphMeta
}

/** What a build did. */
export interface BuildOutcome {
  /** The plan the build followed. */
  readonly plan: UpdatePlan
  /** The state files whose bytes changed. */
  readonly written: readonly string[]
  /** How long the build took, in milliseconds. */
  readonly durationMs: number
}

/** A built state with the graph it describes. */
export interface BuiltState {
  /** The graph. */
  readonly graph: WorkspaceGraph
  /** The state as written. */
  readonly state: PersistedState
  /** What the build did. */
  readonly outcome: BuildOutcome
}

/** How a build runs. */
export interface BuildStateOptions {
  /** Whether to ignore the persisted state and build cold. */
  readonly force?: boolean
}

/** A verification's result. */
export interface Verification {
  /** Whether the persisted state equals a cold build. */
  readonly ok: boolean
  /** The state files that differ, or why the comparison could not run. */
  readonly differences: readonly string[]
}

/** The state files, by the key of the state they hold. */
export const STATE_FILES = freeze({
  files: 'files.json',
  imports: 'imports.json',
  graph: 'graph.json',
  entries: 'entries.json',
  meta: 'meta.json',
} as const)

/** A key of the state. */
export type StateKey = keyof typeof STATE_FILES

/**
 * The state directory of a workspace.
 *
 * @param root - The workspace root, absolute
 * @returns `<root>/.hf/graph`
 */
export function stateDirectory(root: string): string {
  return join(root, '.hf', 'graph')
}

/**
 * The persisted state of a workspace, or nothing when any of its files is missing or invalid.
 *
 * @param root - The workspace root, absolute
 * @returns The state, or null
 */
export function readState(root: string): PersistedState | null {
  const directory = stateDirectory(root)
  const files = readStateFile<FilesBody>(join(directory, STATE_FILES.files))
  const imports = readStateFile<ImportsBody>(join(directory, STATE_FILES.imports))
  const graph = readStateFile<GraphBody>(join(directory, STATE_FILES.graph))
  const closures = readStateFile<EntriesBody>(join(directory, STATE_FILES.entries))
  const meta = readStateFile<GraphMeta>(join(directory, STATE_FILES.meta))
  if (files === null || imports === null || graph === null || closures === null || meta === null) return null
  return { files, imports, graph, entries: closures, meta }
}

/**
 * Computes the state of the working tree from a plan: the reused imports, the reparsed ones, and
 * the graph built from them.
 *
 * @param root - The workspace root, absolute
 * @param files - The workspace's files with their hashes
 * @param meta - The meta to record
 * @param plan - What to reparse and what to reuse
 * @returns The graph and the state describing it
 */
function computeState(root: string, files: readonly FileRecord[], meta: GraphMeta, plan: UpdatePlan): Omit<BuiltState, 'outcome'> {
  const imports = createMap<string, readonly FileImport[] | null>()
  for (const [path, record] of plan.reuse) imports.set(path, record.imports)
  for (const path of plan.reparse) imports.set(path, readImports(root, path))
  const graph = buildGraph(root, { files: files.map((record) => record.path), imports })
  const hashes = hashesByPath(files)
  const state: PersistedState = {
    files: { files },
    imports: { files: importsBody(imports, hashes) },
    graph: graphBody(graph),
    entries: { entries: entriesBody(graph, hashes) },
    meta,
  }
  return { graph, state }
}

/**
 * Builds the state of a workspace under its lock: reads what is persisted, redoes what the plan
 * says, writes the files whose bytes changed.
 *
 * @param root - The workspace root, absolute
 * @param options - Whether to build cold
 * @returns The graph, the state and what the build did
 */
export function buildState(root: string, options: BuildStateOptions = {}): BuiltState {
  const started = performance.now()
  return withLock(stateDirectory(root), () => {
    const files = listFileRecords(root)
    const meta = currentMeta(root, files)
    const plan = planUpdate(options.force === true ? null : readState(root), meta, files)
    const { graph, state } = computeState(root, files, meta, plan)
    const written: string[] = []
    for (const [key, name] of entries(STATE_FILES)) {
      if (writeStateFile(join(stateDirectory(root), name), envelopeText(state[key as StateKey]))) written.push(name)
    }
    return { graph, state, outcome: { plan, written, durationMs: performance.now() - started } }
  })
}

/**
 * Verifies the persisted state against a cold build of the working tree.
 *
 * @param root - The workspace root, absolute
 * @returns Whether every state file agrees, and which do not
 */
export function verifyState(root: string): Verification {
  const persisted = readState(root)
  if (persisted === null) return { ok: false, differences: ['no persisted state'] }
  const files = listFileRecords(root)
  const meta = currentMeta(root, files)
  const { state } = computeState(root, files, meta, planUpdate(null, meta, files))
  const differences = entries(STATE_FILES)
    .filter(([key]) => digestOf(state[key as StateKey]) !== digestOf(persisted[key as StateKey]))
    .map(([, name]) => name)
  return { ok: differences.length === 0, differences }
}

/** A plan as `status` reports it: the files to parse counted rather than listed. */
export interface StatusPlan extends Omit<UpdatePlan, 'reuse' | 'reparse'> {
  /** How many code files a build would parse. */
  readonly reparse: number
}

/** What `status` reports. */
export interface StateStatus {
  /** Whether a valid state is persisted. */
  readonly present: boolean
  /** The persisted meta, or null. */
  readonly meta: GraphMeta | null
  /** The digest of each persisted state file's body, or null. */
  readonly digests: Readonly<Record<string, string>> | null
  /** What a build would do now. */
  readonly plan: StatusPlan
}

/**
 * What is persisted and what a build would do, without building.
 *
 * @param root - The workspace root, absolute
 * @returns Whether a state is persisted, its meta and digests, and the plan
 */
export function stateStatus(root: string): StateStatus {
  const persisted = readState(root)
  const files = listFileRecords(root)
  const { mode, reasons, added, changed, deleted, reparse } = planUpdate(persisted, currentMeta(root, files), files)
  const digests =
    persisted === null ? null : fromEntries(entries(STATE_FILES).map(([key, name]) => [name, digestOf(persisted[key as StateKey])]))
  return {
    present: persisted !== null,
    meta: persisted?.meta ?? null,
    digests,
    plan: { mode, reasons, added, changed, deleted, reparse: reparse.length },
  }
}
