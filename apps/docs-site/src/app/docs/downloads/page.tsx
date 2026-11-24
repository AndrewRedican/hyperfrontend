import { Breadcrumb } from '@/components/breadcrumb'
import { LiveDownloads } from '@/components/downloads/live-downloads'
import { H1 } from '@/components/heading-with-anchor'
import { getDownloadsSnapshot } from '@/lib/downloads'
import { DOWNLOADS_ROUTE } from '@/lib/downloads-route'
import { getPageMetadata } from '@/lib/metadata'
import { REVALIDATION_DAYS } from '@/lib/npm-downloads/model'
import { REPO_URL } from '@/lib/site'
import Link from 'next/link'

export const metadata = getPageMetadata({
  title: 'Downloads',
  description:
    'npm download history for every published HyperFrontend package: totals, rankings, and trends built from daily records collected from npm.',
  path: DOWNLOADS_ROUTE,
})

/** Where the persisted history and the collector live, for readers who want to audit either. */
const DATASET_URL = `${REPO_URL}/tree/main/apps/docs-site/data/npm-downloads`

/** @see {@link DATASET_URL} */
const COLLECTOR_URL = `${REPO_URL}/tree/main/apps/statistics/src/collector`

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
          No download history has been collected for this build yet. Run the refresh and rebuild to see it here.
        </p>
      ) : (
        <LiveDownloads snapshot={snapshot} />
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
            The daily records are committed to the repository, one file per package, and the site is built from those files. A small service
            collects npm&apos;s counts on a schedule and holds the full history. It reads every history again, whole, whenever npm counts a
            new day, because npm reports a day it has not processed yet as zero and fills it in later, sometimes more than a week later.
            When this page opens it asks that service for the days counted since the page was built, and for the most recent{' '}
            {REVALIDATION_DAYS} days because the latest counts are the ones that settle most often. The service states each package&apos;s
            total with its answer, and when a package here still adds up to something else, an older day has been corrected and the page
            asks for the whole history once. When the service cannot be reached, the page shows the figures it was built with. The
            production build takes the whole history from the same service before it renders. So a total is reproducible from npm&apos;s own
            counts, and anyone can audit both the{' '}
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
