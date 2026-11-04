'use client'

import type { GitHubRun, RunIndex, RunsPage } from '@/lib/ci/model'
import type { RunSummary } from '@/lib/ci/run-browser'
import type { Pending } from '../placeholder'
import { readCached } from '@/lib/ci/cache'
import { FetchFailure } from '@/lib/ci/fetch'
import { mergeRuns } from '@/lib/ci/run-browser'
import { API_URL, CI_WORKFLOW_FILE, PR_WORKFLOW_FILE, RECORDS_URL } from '@/lib/ci/sources'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { pendingOf } from '../placeholder'

/** How old the lists may be before a refresh reads them again, in milliseconds. */
export const LIST_MAX_AGE_MS = 60_000

/** How many runs GitHub is asked for: enough to reach past the recorded ones to the pull requests between them. */
const LISTED_RUNS = 40

/** The address of the records index. */
export const INDEX_URL = `${RECORDS_URL}/index.json`

/** The address of the runs GitHub lists. */
export const RUNS_URL = `${API_URL}/actions/runs?per_page=${LISTED_RUNS}`

/** The runs the page knows, from both sources. */
export interface RunList {
  /** Every run, newest first */
  runs: RunSummary[]
  /** The runs GitHub listed, by id, for what the summaries leave out */
  listed: ReadonlyMap<number, GitHubRun>
  /** Why the records are not here yet, or null once they are */
  indexPending: Pending
  /** Why GitHub's list is not here yet, or null once it is; the records alone still make a browser */
  listPending: Pending
  /** When the lists were last read, or null */
  readAt: number | null
  /** Reads both lists again, when they are old enough */
  refresh: () => void
}

/**
 * The runs the records branch and GitHub list, read once on mount and again on each refresh;
 * either source failing leaves the other's runs in place.
 * @param token - The reader's token, or null
 * @returns The runs and the state of each source
 */
export function useRunList(token: string | null): RunList {
  const [index, setIndex] = useState<RunIndex | null>(null)
  const [page, setPage] = useState<RunsPage | null>(null)
  const [indexPending, setIndexPending] = useState<Pending>({ state: 'loading', detail: null })
  const [listPending, setListPending] = useState<Pending>({ state: 'loading', detail: null })
  const [readAt, setReadAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((count) => count + 1), [])

  useEffect(() => {
    // why: the reads are shared with other readers and never aborted; a stale mount only ignores their answers
    const controller = new AbortController()
    const settle = (error: unknown, set: (pending: Pending) => void): void => {
      if (controller.signal.aborted) return
      set(
        error instanceof FetchFailure && error.status === 403
          ? { state: 'error', detail: 'GitHub refused the request: the hourly limit is spent.' }
          : pendingOf(error)
      )
    }
    void readCached<RunIndex>(INDEX_URL, { maxAgeMs: LIST_MAX_AGE_MS })
      .then((entry) => {
        if (controller.signal.aborted) return
        setIndex(entry.value)
        setIndexPending(entry.value.runs.length === 0 ? { state: 'empty', detail: null } : null)
        setReadAt(entry.fetchedAt)
      })
      .catch((error: unknown) => settle(error, setIndexPending))
    void readCached<RunsPage>(RUNS_URL, { maxAgeMs: LIST_MAX_AGE_MS, token, persist: true })
      .then((entry) => {
        if (controller.signal.aborted) return
        setPage(entry.value)
        setListPending(null)
        setReadAt(entry.fetchedAt)
      })
      .catch((error: unknown) => settle(error, setListPending))
    return () => controller.abort()
  }, [tick, token])

  const listed = useMemo(() => {
    const byId = createMap<number, GitHubRun>()
    for (const run of page?.workflow_runs ?? []) byId.set(run.id, run)
    return byId
  }, [page])
  const runs = useMemo(
    () =>
      mergeRuns(
        index,
        page === null
          ? null
          : page.workflow_runs.filter((run) => run.path.endsWith(CI_WORKFLOW_FILE) || run.path.endsWith(PR_WORKFLOW_FILE))
      ),
    [index, page]
  )
  return { runs, listed, indexPending, listPending, readAt, refresh }
}
