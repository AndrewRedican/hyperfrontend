'use client'

import type { DurationHistory } from '@/lib/ci/estimate'
import type { RunRecord } from '@/lib/ci/model'
import type { RunSummary } from '@/lib/ci/run-browser'
import { readCached } from '@/lib/ci/cache'
import { historyOf, historyRunsFor } from '@/lib/ci/estimate'
import { useEffect, useMemo, useState } from 'react'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { COMPLETED_MAX_AGE_MS, recordUrl } from './use-execution'

/** Where the history a run is estimated from stands: not asked for, being read, read, or unreadable. */
export type HistoryState = 'idle' | 'loading' | 'ready' | 'error'

/** The history a run is estimated from. */
export interface FollowedHistory {
  /** The history, or null until it is read */
  history: DurationHistory | null
  /** Where it stands */
  state: HistoryState
}

/** What a read of some records came to. */
interface Loaded {
  /** The ids read, joined */
  key: string
  /** The history, or null when no record could be read */
  history: DurationHistory | null
}

/**
 * What the recorded runs before a run say about how long its tasks take: their records, read
 * once each from the records branch and kept for the visit. Nothing is read until it is wanted.
 * @param runs - Every run known
 * @param selected - The run to estimate, or null
 * @param wanted - Whether an estimate or an expected duration is on show
 * @returns The history and where it stands
 */
export function useHistory(runs: readonly RunSummary[], selected: RunSummary | null, wanted: boolean): FollowedHistory {
  const key = useMemo(() => (selected === null ? '' : historyRunsFor(runs, selected).join(',')), [runs, selected])
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!wanted || key === '') return
    let abandoned = false
    void promiseAll(
      key.split(',').map((id) =>
        readCached<RunRecord>(recordUrl(parseInt(id, 10)), { maxAgeMs: COMPLETED_MAX_AGE_MS }).then(
          (entry) => entry.value,
          () => null
        )
      )
    ).then((records: (RunRecord | null)[]) => {
      if (abandoned) return
      const read = records.filter((record): record is RunRecord => record !== null)
      setLoaded({ key, history: read.length === 0 ? null : historyOf(read) })
    })
    return () => {
      abandoned = true
    }
  }, [key, wanted])

  if (!wanted) return { history: loaded?.key === key ? loaded.history : null, state: 'idle' }
  if (key === '') return { history: null, state: 'error' }
  if (loaded?.key !== key) return { history: null, state: 'loading' }
  return { history: loaded.history, state: loaded.history === null ? 'error' : 'ready' }
}
