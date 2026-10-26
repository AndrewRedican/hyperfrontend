/**
 * Settles what a run that did not end left behind: every check run it created and never
 * completed is completed as cancelled, with the tasks that had ended by then.
 *
 * @module pipeline/finalize
 */

import type { CheckApi, CheckRecords } from './checks'
import type { Plan, RunResults } from './model'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { checkName, chainOutput } from './checks'

/** What settling needs. */
export interface SettleOptions {
  /** The check runs the run created, by name. */
  readonly records: CheckRecords
  /** The plan the run executed, or null when it is not at hand. */
  readonly plan: Plan | null
  /** The results the run wrote so far, or null when it wrote none. */
  readonly results: RunResults | null
  /** Completes check runs. */
  readonly api: Pick<CheckApi, 'complete'>
}

/** What settling did. */
export interface Settlement {
  /** The check runs, every one completed. */
  readonly records: CheckRecords
  /** The names of the check runs settled here. */
  readonly settled: readonly string[]
}

/** What the check run says when the run ended before the chain did. */
const TITLE = 'the run ended before the chain finished'

/**
 * Completes every open check run as cancelled.
 *
 * @param options - The records, the plan, the partial results and the API
 * @returns The records with every check run completed, and the names settled
 */
export async function settleChecks(options: SettleOptions): Promise<Settlement> {
  const settled: string[] = []
  const records: Record<string, CheckRecords[string]> = { ...options.records }
  for (const [name, record] of entries(records)) {
    if (record.completed) continue
    const chain = options.plan?.chains.find((candidate) => checkName(candidate) === name)
    const ended = chain === undefined ? [] : (options.results?.tasks ?? []).filter((task) => task.project === chain.project)
    const output =
      chain === undefined
        ? { title: TITLE, summary: 'The plan the chain belongs to is not at hand.' }
        : chainOutput(
            chain,
            ended,
            ended.length === 0 ? `${TITLE}; no task of it had ended` : `${TITLE}; ${ended.length} of ${chain.tasks.length} tasks had ended`
          )
    await options.api.complete(record.id, 'cancelled', output)
    records[name] = { id: record.id, completed: true }
    settled.push(name)
  }
  return { records: fromEntries(entries(records)), settled }
}
