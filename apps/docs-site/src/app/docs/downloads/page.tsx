import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { DownloadsDashboard } from '@/components/downloads/downloads-dashboard'
import { H1 } from '@/components/heading-with-anchor'
import { formatArticleDate } from '@/lib/article-format'
import { getDownloadsSnapshot } from '@/lib/downloads'
import { DOWNLOADS_ROUTE, formatExactCount } from '@/lib/downloads-route'
import { CHUNK_DAYS, MIN_REQUEST_GAP_MS, REVALIDATION_DAYS } from '@/lib/npm-downloads/model'
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
            Every figure on this page is a sum of daily download counts collected from npm&apos;s public download API, the same counts npm
            shows on a package&apos;s own page. The collection is done by a small tool in this repository, and the records it collects are
            committed beside the site, so both the method and the data are open to inspection.
          </p>
          <h3>Collection</h3>
          <ul>
            <li>
              Counts are requested one day at a time from npm&apos;s <code>range</code> endpoint rather than as one all-time total, because
              the API answers a span longer than eighteen months by quietly returning only the most recent eighteen. A long history is
              therefore fetched in bounded chunks of at most {CHUNK_DAYS} days, and every answer is checked against what was asked for: the
              package it names, the first and last day it covers, and that every day in between is present exactly once.
            </li>
            <li>
              Requests are made one at a time with a pause of at least {MIN_REQUEST_GAP_MS / 1000} second after each, and a failed request
              is retried a few times with a growing pause. Nothing is parallelised: the ecosystem is small, and being unhurried costs a
              minute.
            </li>
            <li>
              A response that is not the documented shape, a span that came back shorter than requested, or a package npm does not know,
              fails the run outright. Nothing is written unless every package came through cleanly, so a bad answer can never be published
              as a number.
            </li>
          </ul>
          <h3>Storage</h3>
          <ul>
            <li>
              Each package&apos;s history is one file of newline-delimited JSON, one line per day, committed to the repository. A refresh
              appends the days npm has counted since the last one and leaves the rest of the file exactly as it was.
            </li>
            <li>
              npm finishes counting a day soon after the UTC midnight that ends it, and a day is not treated as final the moment it appears:
              the most recent {REVALIDATION_DAYS} days behind npm&apos;s newest counted day are read again on every refresh and corrected if
              npm&apos;s count moved. Older days are locked and never requested again.
            </li>
            <li>
              A package&apos;s total is the sum of its stored days. The ecosystem total is the sum of every published package&apos;s total.
              Neither is adjusted for packages that depend on one another, so the figures are raw npm downloads and not unique
              installations.
            </li>
          </ul>
          <h3>Display</h3>
          <ul>
            <li>
              The site is built from the committed records and never asks npm while building or while being read, so a page is a function of
              the repository at the commit it was built from.
            </li>
            <li>
              Charts fold the daily records into display buckets chosen from the length of each history: days for a young package, weeks for
              one a few months old, months for one with years behind it. The buckets are for reading; the stored records stay daily.
            </li>
          </ul>
          <p>
            The collector lives at{' '}
            <a href={COLLECTOR_URL} target="_blank" rel="noopener noreferrer">
              apps/docs-site/src/lib/npm-downloads
            </a>{' '}
            and the records it has collected at{' '}
            <a href={DATASET_URL} target="_blank" rel="noopener noreferrer">
              apps/docs-site/data/npm-downloads
            </a>
            . Each package page links here with that package in focus, and the <Link href="/">landing page</Link> carries the ecosystem
            total.
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
