import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { DownloadsDashboard } from '@/components/downloads/downloads-dashboard'
import { H1 } from '@/components/heading-with-anchor'
import { formatArticleDate } from '@/lib/article-format'
import { getDownloadsSnapshot } from '@/lib/downloads'
import { DOWNLOADS_ROUTE, formatExactCount } from '@/lib/downloads-route'
import { REVALIDATION_DAYS } from '@/lib/npm-downloads/model'
import { REPO_URL } from '@/lib/site'
import Link from 'next/link'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Downloads',
  description:
    'npm download history for every published HyperFrontend package: totals, rankings, and trends built from daily records collected from npm.',
  alternates: { canonical: DOWNLOADS_ROUTE },
}

/** Where the persisted history and the collector live, for readers who want to audit either. */
const DATASET_URL = `${REPO_URL}/tree/main/apps/docs-site/data/npm-downloads`

/** @see {@link DATASET_URL} */
const COLLECTOR_URL = `${REPO_URL}/tree/main/apps/docs-site/src/lib/npm-downloads`

/** The write-up this approach owes most of its pitfalls to. */
const TANSTACK_ARTICLE_URL = 'https://tanstack.com/blog/npm-stats-the-right-way'

export default function DownloadsPage() {
  const snapshot = getDownloadsSnapshot()

  return (
    <>
      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Downloads</H1>
      {snapshot === null ? (
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
          No download history has been collected for this build yet. Run the collector and rebuild to see it here.
        </p>
      ) : (
        <>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            <strong className="font-semibold text-slate-900 dark:text-white">{formatExactCount(snapshot.total)}</strong> npm downloads
            across {snapshot.packages.length} published packages, counted through {formatArticleDate(snapshot.frontier)}.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Raw package downloads as npm counts them, summed from daily records; a package that depends on another in the ecosystem is
            counted for both, so this is not a number of users or installations.
          </p>

          {/* why: the focused package lives in the query string, and useSearchParams needs a boundary to stream past during the static build */}
          <Suspense fallback={<p className="mt-8 text-slate-600 dark:text-slate-400">Loading charts…</p>}>
            <DownloadsDashboard snapshot={snapshot} />
          </Suspense>
        </>
      )}

      <details className="methodology mt-12">
        <summary className="methodology__summary">How these numbers are calculated</summary>
        <div className="methodology__body">
          <p>
            Every figure on this page is a sum of daily download counts from npm&apos;s public download statistics, the same counts npm
            shows on a package&apos;s own page. History is collected one day at a time rather than as a single all-time total, because npm
            answers a request spanning more than eighteen months by quietly returning only the most recent eighteen; long histories are
            fetched in bounded ranges instead, and every answer is checked against the package and the days it was asked for before anything
            is kept.
          </p>
          <p>
            The daily records are committed to the repository, one file per package, and the site is built from those files without asking
            npm at build time or while being read. A refresh appends the days npm has counted since the last one, and re-reads the most
            recent {REVALIDATION_DAYS} days because npm&apos;s latest counts can still settle; older days are never requested again. So a
            total is reproducible from the records at the commit a page was built from, and anyone can audit both the{' '}
            <a href={DATASET_URL} target="_blank" rel="noopener noreferrer">
              data
            </a>{' '}
            and the{' '}
            <a href={COLLECTOR_URL} target="_blank" rel="noopener noreferrer">
              collector
            </a>
            .
          </p>
          <p>
            A package&apos;s total is the sum of its stored days, and the ecosystem total is the sum of every published package&apos;s
            total; neither is adjusted for packages that depend on one another. Charts fold the daily records into days, weeks or months
            depending on how long a history is. The buckets are for reading; the stored records stay daily. Each package page links here
            with that package in focus, and the <Link href="/">landing page</Link> carries the ecosystem total.
          </p>
          <p className="methodology__thanks">
            Thanks to the TanStack team for publishing their research into npm download statistics and laying much of the groundwork for
            this approach. Their{' '}
            <a href={TANSTACK_ARTICLE_URL} target="_blank" rel="noopener noreferrer">
              write-up
            </a>{' '}
            helped us avoid several npm API pitfalls, the silent eighteen-month truncation above all, and we are similarly keeping our
            methodology and data auditable. This is an acknowledgement of work they shared openly, not an association with or endorsement of
            HyperFrontend.
          </p>
        </div>
      </details>
    </>
  )
}
