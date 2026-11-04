'use client'

import type { Execution } from '@/lib/ci/execution'
import type { CheckRunsPage, GitHubCheckRun, GitHubRun, RunRecord } from '@/lib/ci/model'
import type { PollPace } from '@/lib/ci/poll'
import type { RunSummary } from '@/lib/ci/run-browser'
import type { Pending } from '../placeholder'
import { rateLimit, readCached } from '@/lib/ci/cache'
import { PLAN_CHECK_NAME, epochOf, fromLive, fromRecord, planCheckFor } from '@/lib/ci/execution'
import { CHECK_RUNS_PER_PAGE, laterPages, pollPace } from '@/lib/ci/poll'
import { API_URL, RECORDS_URL } from '@/lib/ci/sources'
import { useCallback, useEffect, useRef, useState } from 'react'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { describeFailure, pendingOf } from '../placeholder'

/** How old a completed run's check runs may be: they never change, so a copy lasts the visit. */
const COMPLETED_MAX_AGE_MS = 86_400_000

/** How old a listing of the followed run may be before a poll reads it again: always, the pace decides. */
const FOLLOWED_MAX_AGE_MS = 0

/** The execution the page follows. */
export interface FollowedExecution {
  /** The execution, or null before it is read */
  execution: Execution | null
  /** Why it is not here yet, or null once it is; an error after a read leaves the last execution in place */
  pending: Pending
  /** The last failure, or null */
  failure: string | null
  /** When the execution is read next, or null once it has completed */
  pace: PollPace | null
  /** Reads the execution again now */
  refresh: () => void
}

/**
 * The address of a run's record.
 * @param id - The run id
 * @returns The address on the records branch
 */
function recordUrl(id: number): string {
  return `${RECORDS_URL}/runs/${id}.json`
}

/**
 * One read of a live run: the run itself when it is not already known, then every page of its
 * suite's check runs and, when the plan is not among them, as a pull request's is not, the check
 * runs of the suite the plan went to, found by name among the commit's.
 * @param summary - The run
 * @param known - The run as GitHub listed it, or null
 * @param token - The reader's token
 * @param signal - Aborts the read
 * @returns The execution and how many requests the read made
 */
async function readLive(
  summary: RunSummary,
  known: GitHubRun | null,
  token: string | null,
  signal: AbortSignal
): Promise<[Execution, number]> {
  let requests = 0
  const active = known === null || known.status !== 'completed'
  const maxAgeMs = active ? FOLLOWED_MAX_AGE_MS : COMPLETED_MAX_AGE_MS
  const get = async <Value>(url: string): Promise<Value> => {
    requests += 1
    if (signal.aborted) throw new DOMException('the read was abandoned', 'AbortError')
    return (await readCached<Value>(url, { maxAgeMs, token })).value
  }
  const suiteRuns = async (suiteId: number): Promise<GitHubCheckRun[]> => {
    const suite = `${API_URL}/check-suites/${suiteId}/check-runs?per_page=${CHECK_RUNS_PER_PAGE}&page=`
    const first = await get<CheckRunsPage>(`${suite}1`)
    const later = await promiseAll(laterPages(first.total_count).map((page) => get<CheckRunsPage>(`${suite}${page}`)))
    return [first, ...later].flatMap((page) => page.check_runs)
  }
  const run = known ?? (await get<GitHubRun>(`${API_URL}/actions/runs/${summary.id}`))
  let checkRuns = await suiteRuns(run.check_suite_id)
  if (!checkRuns.some((check) => check.name === PLAN_CHECK_NAME)) {
    const named = await get<CheckRunsPage>(
      `${API_URL}/commits/${run.head_sha}/check-runs?check_name=${encodeURIComponent(PLAN_CHECK_NAME)}&per_page=20`
    )
    const plan = planCheckFor(named.check_runs, epochOf(run.run_started_at) ?? epochOf(run.created_at))
    // why: the plan's suite is read for the plan and the chains alone; the run's jobs are in its own suite
    if (plan !== null && plan.check_suite.id !== run.check_suite_id)
      checkRuns = [
        ...checkRuns,
        ...(await suiteRuns(plan.check_suite.id)).filter(
          (check) => check.name === PLAN_CHECK_NAME || / \((linux|windows|macos)\)$/.test(check.name)
        ),
      ]
  }
  return [fromLive(run, checkRuns, dateNow()), requests]
}

/**
 * The execution of a run: its record when the records branch holds one, else its check runs on
 * GitHub, read again at the pace the rate limit allows while it runs and the tab is visible.
 * @param summary - The run, or null for none
 * @param known - The run as GitHub listed it, or null
 * @param token - The reader's token, or null
 * @param visible - Whether the tab is visible
 * @param onRead - Called after each read of a live run
 * @returns The execution and how it is being read
 */
export function useExecution(
  summary: RunSummary | null,
  known: GitHubRun | null,
  token: string | null,
  visible: boolean,
  onRead: (execution: Execution) => void
): FollowedExecution {
  const [execution, setExecution] = useState<Execution | null>(null)
  // why: the read decides what to keep from the execution it last produced without re-running when that execution changes
  const latest = useRef<Execution | null>(null)
  latest.current = execution
  const [pending, setPending] = useState<Pending>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [pace, setPace] = useState<PollPace | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((count) => count + 1), [])
  const id = summary?.id ?? null
  const completed = known?.status === 'completed'

  useEffect(() => {
    if (summary === null) {
      setExecution(null)
      setPending(null)
      setPace(null)
      return
    }
    const held = latest.current?.run.id === summary.id
    // why: a hidden tab keeps what it has; the read resumes when the tab is shown again
    if (!visible && held) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    setPending((current) => (held ? current : { state: 'loading', detail: null }))
    const read = async (): Promise<void> => {
      let next: PollPace | null = null
      try {
        if (summary.recorded) {
          const entry = await readCached<RunRecord>(recordUrl(summary.id), { maxAgeMs: COMPLETED_MAX_AGE_MS })
          if (controller.signal.aborted) return
          setExecution(fromRecord(entry.value))
        } else {
          const [live, requests] = await readLive(summary, known, token, controller.signal)
          if (controller.signal.aborted) return
          setExecution(live)
          onRead(live)
          if (live.status !== 'completed') next = pollPace(requests, rateLimit(), dateNow())
        }
        setPending(null)
        setFailure(null)
      } catch (error) {
        if (controller.signal.aborted) return
        if (latest.current?.run.id === summary.id) setFailure(describeFailure(error))
        else setPending(pendingOf(error))
        if (!summary.recorded && !completed) next = pollPace(3, rateLimit(), dateNow())
      }
      setPace(next)
      if (next !== null && visible) timer = setTimeout(() => void read(), next.at - dateNow())
    }
    void read()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [summary, known, completed, token, visible, tick, onRead])

  return { execution: execution?.run.id === id ? execution : null, pending, failure, pace, refresh }
}
