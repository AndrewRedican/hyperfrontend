'use client'

import type { DownloadsSnapshot } from '@/lib/downloads'
import { formatArticleDate } from '@/lib/article-format'
import { formatExactCount } from '@/lib/downloads-route'
import { readLiveSnapshot } from '@/lib/npm-downloads/live'
import { STATISTICS_ORIGIN } from '@/lib/site'
import { Suspense, useEffect, useState } from 'react'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { DownloadsDashboard } from './downloads-dashboard'

/** Props for {@link LiveDownloads}. */
export interface LiveDownloadsProps {
  /** Everything the page was built with, read at build time */
  snapshot: DownloadsSnapshot
}

/**
 * Ask the statistics service for its answer.
 *
 * @param since - The first day wanted, or null for the whole history
 * @param signal - Aborts the request when the page is left
 * @returns The parsed body of a 200
 * @throws {Error} When the service answered anything else; a failed request rejects by itself
 */
async function askService(since: string | null, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${STATISTICS_ORIGIN}/v1/downloads${since === null ? '' : `?since=${since}`}`, { signal })
  if (response.status !== 200) throw createError(`the statistics service answered ${response.status}`)
  return response.json()
}

/**
 * The downloads page below its title: the headline total, what it counts,
 * and the dashboard, all drawn from one snapshot.
 *
 * The first render uses the snapshot the page was built with, so it matches
 * the static HTML. Once mounted it asks the statistics service for the days
 * counted since the build, and for the most recent days npm may still revise,
 * then for the whole history when an older day turns out to have changed too,
 * and redraws everything from the result, so the headline number and the
 * charts always agree. When the service cannot be reached the built figures
 * simply stay.
 * @param props - See {@link LiveDownloadsProps}.
 * @param props.snapshot - Everything the page was built with
 * @returns The summary and the dashboard.
 */
export function LiveDownloads({ snapshot: built }: LiveDownloadsProps) {
  const [snapshot, setSnapshot] = useState(built)

  useEffect(() => {
    const controller = new AbortController()
    readLiveSnapshot(built, (since) => askService(since, controller.signal)).then(
      (live) => {
        if (!controller.signal.aborted) setSnapshot(live)
      },
      // why: every way this can fail has the same answer, the built figures are already on the page and stay there, so nothing is shown and nothing is logged
      () => undefined
    )
    return () => controller.abort()
  }, [built])

  return (
    <>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        <strong className="font-semibold text-slate-900 dark:text-white">{formatExactCount(snapshot.total)}</strong> npm downloads across{' '}
        {snapshot.packages.length} published packages, counted through {formatArticleDate(snapshot.frontier)}.
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Raw package downloads as npm counts them, summed from daily records; a package that depends on another in the ecosystem is counted
        for both, so this is not a number of users or installations.
      </p>

      {/* why: the focused package lives in the query string, and useSearchParams needs a boundary to stream past during the static build; it sits here, around the dashboard alone, so the summary above stays in the built HTML */}
      <Suspense fallback={<p className="mt-8 text-slate-600 dark:text-slate-400">Loading charts…</p>}>
        <DownloadsDashboard snapshot={snapshot} />
      </Suspense>
    </>
  )
}
