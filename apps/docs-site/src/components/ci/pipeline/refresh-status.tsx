'use client'

import type { PollPace } from '@/lib/ci/poll'
import { readToken } from '@/lib/ci/fetch'
import { formatClock, formatCountdown } from '@/lib/ci/pipeline-view'
import { useEffect } from 'react'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Props for {@link RefreshStatus}. */
export interface RefreshStatusProps {
  /** When the execution was last read, or null */
  readAt: number | null
  /** When it is read next, or null when it will not be */
  pace: PollPace | null
  /** Whether the execution is a record, which never changes */
  recorded: boolean
  /** The last failure, or null */
  failure: string | null
  /** The current time */
  now: number
  /** Reads again now */
  onRefresh: () => void
  /** Told the token the reader keeps */
  onToken: (token: string | null) => void
}

/**
 * When the page last read the run and when it reads it next, with a countdown and a refresh; a
 * token a reader once kept in this browser is still sent to GitHub.
 * @param props - See {@link RefreshStatusProps}.
 * @param props.readAt
 * @param props.pace
 * @param props.recorded
 * @param props.failure
 * @param props.now
 * @param props.onRefresh
 * @param props.onToken
 * @returns The line
 */
export function RefreshStatus({ readAt, pace, recorded, failure, now, onRefresh, onToken }: RefreshStatusProps) {
  useEffect(() => {
    onToken(readToken())
  }, [onToken])

  const progress = pace === null ? 0 : min(1, max(0, 1 - (pace.at - now) / pace.everyMs))
  return (
    <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {failure === null ? null : (
          <span role="alert" className="text-rose-700 dark:text-rose-300">
            {failure}
          </span>
        )}
        {readAt === null ? null : <span>{recorded ? `Recorded ${formatClock(readAt)}, final.` : `Read ${formatClock(readAt)}.`}</span>}
        {pace === null ? null : (
          <span className="inline-flex items-center gap-2">
            <span>
              Next read in {formatCountdown(pace.at, now)}
              {pace.waitsForReset ? ', when GitHub renews the hour' : ''}
            </span>
            <span className="h-1 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-slate-400 transition-[width] duration-1000 ease-linear dark:bg-slate-500"
                style={{ width: `${progress * 100}%` }}
              />
            </span>
          </span>
        )}
        {recorded ? null : (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Read now
          </button>
        )}
      </div>
    </div>
  )
}
