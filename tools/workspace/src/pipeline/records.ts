/**
 * The record of a run the main workflow keeps on the `ci-records` branch: the plan and every
 * environment's results under `runs/<run id>.json`, and `index.json`, the newest runs first,
 * each with the little a list needs.
 *
 * @module pipeline/records
 */

import type { ExplorerDocument } from './explorer'
import type { Environment, Outcome as OutcomeKind, Plan, PlanMode, RunResults } from './model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { Outcome } from './model'

/** The schema of the records. */
export const RECORDS_SCHEMA = 1

/** How many runs the index keeps. */
export const INDEX_LIMIT = 500

/** Which workflow run a record is of. */
export interface RunIdentity {
  /** The run id. */
  readonly id: number
  /** The run number. */
  readonly number: number
  /** The run attempt. */
  readonly attempt: number
  /** The commit. */
  readonly sha: string
  /** The ref. */
  readonly ref: string
  /** The event that started it. */
  readonly event: string
  /** The run's page. */
  readonly url: string
}

/** What a run ended as, over every environment. */
export const RunOutcome = freeze({
  /** Every task of every environment succeeded. */
  Success: 'success',
  /** A task failed or was skipped behind a failure. */
  Failure: 'failure',
  /** A task was cancelled. */
  Cancelled: 'cancelled',
  /** An environment's results are missing or did not reach the end. */
  Incomplete: 'incomplete',
} as const)

/** One of the outcomes. */
export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome]

/** The record of one run. */
export interface RunRecord {
  /** The schema. */
  readonly schema: typeof RECORDS_SCHEMA
  /** Which run. */
  readonly run: RunIdentity
  /** When the record was written, epoch milliseconds. */
  readonly recordedAt: number
  /** The plan the run executed. */
  readonly plan: Plan
  /** Each environment's results, when the run uploaded them. */
  readonly results: Partial<Record<Environment, RunResults>>
}

/** One run as the index lists it. */
export interface RunIndexEntry extends RunIdentity {
  /** When the record was written, epoch milliseconds. */
  readonly recordedAt: number
  /** Whether the plan was selected or ran everything. */
  readonly mode: PlanMode
  /** Whether the plan published. */
  readonly main: boolean
  /** The environments the plan had chains for. */
  readonly environments: readonly Environment[]
  /** How many chains. */
  readonly chains: number
  /** How many tasks. */
  readonly tasks: number
  /** What the run ended as. */
  readonly outcome: RunOutcome
}

/** The index of the records. */
export interface RunIndex {
  /** The schema. */
  readonly schema: typeof RECORDS_SCHEMA
  /** The runs, newest first. */
  readonly runs: readonly RunIndexEntry[]
}

/**
 * The record of a run.
 *
 * @param run - Which run
 * @param plan - The plan it executed
 * @param results - Each environment's results that it uploaded
 * @param recordedAt - When the record is written
 * @returns The record, stamped with its schema
 */
export function runRecord(run: RunIdentity, plan: Plan, results: Partial<Record<Environment, RunResults>>, recordedAt: number): RunRecord {
  return { schema: RECORDS_SCHEMA, run, recordedAt, plan, results }
}

/**
 * What a record's run ended as.
 *
 * @param record - The run's record
 * @returns Incomplete when an environment's results are missing or did not end, else the worst task outcome
 */
export function recordOutcome(record: RunRecord): RunOutcome {
  const outcomes: OutcomeKind[] = []
  for (const environment of record.plan.environments) {
    const results = record.results[environment]
    if (results === undefined || !results.complete) return RunOutcome.Incomplete
    outcomes.push(...results.tasks.map((task) => task.outcome))
  }
  if (outcomes.some((outcome) => outcome === Outcome.Failure || outcome === Outcome.Skipped)) return RunOutcome.Failure
  if (outcomes.some((outcome) => outcome === Outcome.Cancelled)) return RunOutcome.Cancelled
  return RunOutcome.Success
}

/**
 * A record as the index lists it.
 *
 * @param record - The run's record
 * @returns The entry the index lists the run as
 */
export function indexEntry(record: RunRecord): RunIndexEntry {
  return {
    ...record.run,
    recordedAt: record.recordedAt,
    mode: record.plan.mode,
    main: record.plan.main,
    environments: record.plan.environments,
    chains: record.plan.chains.length,
    tasks: record.plan.chains.reduce((count, chain) => count + chain.tasks.length, 0),
    outcome: recordOutcome(record),
  }
}

/**
 * The index with a run added or replaced, newest first.
 *
 * @param index - The index so far, or null for none
 * @param entry - The run
 * @param limit - How many runs to keep
 * @returns The index, newest first
 */
export function updateIndex(index: RunIndex | null, entry: RunIndexEntry, limit: number = INDEX_LIMIT): RunIndex {
  const others = (index?.runs ?? []).filter((run) => run.id !== entry.id)
  return { schema: RECORDS_SCHEMA, runs: [entry, ...others].sort((left, right) => right.number - left.number).slice(0, limit) }
}

/** What a record is made of. */
export interface RecordOptions {
  /** Which run. */
  readonly run: RunIdentity
  /** The plan it executed. */
  readonly plan: Plan
  /** Each environment's results that it uploaded. */
  readonly results: Partial<Record<Environment, RunResults>>
  /** The explorer document of the graph the plan was made from, or null when the run uploaded none. */
  readonly explorer: ExplorerDocument | null
  /** When the record is written. */
  readonly recordedAt: number
}

/** Where the records live. */
export interface RecordStore {
  /** Writes a JSON document at a path relative to the records directory. */
  readonly write: (path: string, value: unknown) => void
  /** The index so far, or null for none. */
  readonly readIndex: () => RunIndex | null
}

/**
 * Writes a run's record, the index with it listed, and the graph the plan was made from.
 *
 * @param options - The run, the plan, the results, the explorer document and the time
 * @param store - Where the records live
 * @returns The index after the run was listed
 */
export function writeRunRecord(options: RecordOptions, store: RecordStore): RunIndex {
  const record = runRecord(options.run, options.plan, options.results, options.recordedAt)
  store.write(`runs/${options.run.id}.json`, record)
  const index = updateIndex(store.readIndex(), indexEntry(record))
  store.write('index.json', index)
  if (options.explorer !== null) store.write('graph/latest.json', options.explorer)
  return index
}
