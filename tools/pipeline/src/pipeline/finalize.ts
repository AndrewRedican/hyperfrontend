/**
 * Settles what a run left behind: every check run it created and never completed is completed,
 * as cancelled with the tasks that had ended by then when the run stopped short of the chain, and
 * with the chain's own conclusion when every task of it has a result.
 *
 * @module pipeline/finalize
 */

import type { CheckApi, CheckRecords } from './checks'
import type { Plan, RunResults } from './model'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { chainConclusion, chainOutput, checkName } from './checks'

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

/** One check run settling completed. */
export interface Settled {
  /** The name of the check run. */
  readonly name: string
  /** What it was completed as. */
  readonly conclusion: string
}

/** What settling did. */
export interface Settlement {
  /** The check runs, each completed unless the API would not take its completion. */
  readonly records: CheckRecords
  /** The check runs settled here, with what each was completed as. */
  readonly settled: readonly Settled[]
  /** The names of the check runs the API would not complete, which stay in progress. */
  readonly unsettled: readonly string[]
  /** What the API answered the first of those with, or null when every one was completed. */
  readonly reason: string | null
}

/** What the check run says when the run ended before the chain did. */
const TITLE = 'the run ended before the chain finished'

/**
 * Completes every open check run: with the chain's own conclusion when every task of the chain
 * has a result, which is what a run leaves when the API refused it mid-way, and as cancelled
 * otherwise. Check runs are best-effort, so a completion the API will not take leaves that check
 * run open and is reported, never thrown.
 *
 * @param options - The records, the plan, the partial results and the API
 * @returns The records, the check runs settled with their conclusions, and the ones left open with the first reason
 */
export async function settleChecks(options: SettleOptions): Promise<Settlement> {
  const settled: Settled[] = []
  const unsettled: string[] = []
  let reason: string | null = null
  const records: Record<string, CheckRecords[string]> = { ...options.records }
  for (const [name, record] of entries(records)) {
    if (record.completed) continue
    const chain = options.plan?.chains.find((candidate) => checkName(candidate) === name)
    const ended = chain === undefined ? [] : (options.results?.tasks ?? []).filter((task) => task.project === chain.project)
    const whole = chain !== undefined && ended.length === chain.tasks.length
    const conclusion = whole ? chainConclusion(ended) : 'cancelled'
    const partial =
      ended.length === 0 ? `${TITLE}; no task of it had ended` : `${TITLE}; ${ended.length} of ${chain?.tasks.length} tasks had ended`
    const output =
      chain === undefined
        ? { title: TITLE, summary: 'The plan the chain belongs to is not at hand.' }
        : chainOutput(chain, ended, whole ? `${ended.length} tasks, ${conclusion}` : partial)
    try {
      await options.api.complete(record.id, conclusion, output)
      records[name] = { id: record.id, completed: true }
      settled.push({ name, conclusion })
    } catch (error) {
      unsettled.push(name)
      reason ??= String(error)
    }
  }
  return { records: fromEntries(entries(records)), settled, unsettled, reason }
}
