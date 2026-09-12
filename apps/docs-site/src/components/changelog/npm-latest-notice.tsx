'use client'

import type { LatestPublication } from '@/lib/npm-latest'
import { formatArticleDate } from '@/lib/article-format'
import { fetchLatestPublication, newerThanChangelog } from '@/lib/npm-latest'
import { npmVersionUrl } from '@/lib/npm-url'
import { useEffect, useState } from 'react'

/** Props for {@link NpmLatestNotice}. */
export interface NpmLatestNoticeProps {
  /** Full npm package name */
  packageName: string
  /** The newest version the changelog on this page lists, or null for an empty history */
  newestListed: string | null
}

/**
 * A notice that npm has a release newer than the changelog on this page.
 *
 * The changelog is written late in the release flow, so a docs build can
 * be one release behind the registry until the site is rebuilt. Rather than
 * change how releases are cut to close that gap, the page checks npm in the
 * browser, once, and says so when there is something newer. The check is
 * one request against a document the registry serves compressed and with
 * the CORS header that lets a page ask; any failure resolves to nothing,
 * so the page can only ever gain a notice, never lose its content.
 *
 * When npm and the page agree, nothing at all is rendered.
 * @param props - See {@link NpmLatestNoticeProps}.
 * @param props.packageName - Full npm package name
 * @param props.newestListed - The newest version the page lists
 * @returns The notice, or nothing.
 */
export function NpmLatestNotice({ packageName, newestListed }: NpmLatestNoticeProps) {
  const [newer, setNewer] = useState<LatestPublication | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchLatestPublication(packageName).then((latest) => {
      if (cancelled || latest === null) return
      setNewer(newerThanChangelog(newestListed, latest))
    })
    return () => {
      cancelled = true
    }
  }, [packageName, newestListed])

  if (newer === null) return null

  const href = npmVersionUrl({ version: newer.version, isPrivate: false, license: '', compatibility: null, outputs: [] }, packageName)
  const publishedOn = newer.publishedAt === null ? null : formatArticleDate(newer.publishedAt.slice(0, 10))

  return (
    <div className="npm-latest-notice" role="status">
      <span className="npm-latest-notice__party" aria-hidden="true">
        🎉
      </span>
      <div className="min-w-0">
        <p className="npm-latest-notice__headline">
          {publishedOn === null ? 'A new version was published to npm: ' : `A new version was published on ${publishedOn}: `}
          <a href={href ?? undefined} target="_blank" rel="noopener noreferrer" className="npm-latest-notice__version">
            v{newer.version}
          </a>
        </p>
        <details className="npm-latest-notice__details">
          <summary>Why is it not listed below?</summary>
          <p>
            The release notes for v{newer.version} are not part of this build of the docs yet. They are written into the package&apos;s
            changelog late in the release flow, and will appear here the next time the site is rebuilt.
          </p>
        </details>
      </div>
    </div>
  )
}
