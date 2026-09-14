'use client'

import type { RenderedChangelogRelease } from '@/lib/changelog'
import type { ChangelogFilter } from '@/lib/changelog-filters'
import type { ReleaseStep } from '@/lib/changelog-view'
import { CaretIcon } from '@/components/document/document-icons'
import { formatArticleDate } from '@/lib/article-format'
import { filterReleases, NO_CHANGELOG_FILTER, parseQuery } from '@/lib/changelog-filters'
import { describeSummary, releaseAnchor, releaseStep, summarizeRelease } from '@/lib/changelog-view'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChangelogFilterBar } from './changelog-filter-bar'
import { NpmLatestNotice } from './npm-latest-notice'

/** Props for {@link ChangelogTimeline}. */
export interface ChangelogTimelineProps {
  /** Full npm package name */
  packageName: string
  /** Every release, newest first */
  releases: RenderedChangelogRelease[]
}

/** What the marker on the rail says about a release, in words a reader of the DOM gets. */
const STEP_LABELS: Record<ReleaseStep, string> = {
  initial: 'First release',
  major: 'Major release',
  minor: 'Minor release',
  patch: 'Patch release',
}

/**
 * A package's release history as an expandable timeline.
 *
 * Every release is a section on one rail, collapsed to a line that says
 * what it was: the version, the day, how big a step it took, and what the
 * notes hold in numbers. Opening one shows the notes themselves, grouped as
 * the changelog groups them. The rail's markers carry the step, so a reader
 * scrolling the closed list can see where the majors and the breaking
 * changes fall without opening anything.
 *
 * The filter row narrows the list; while a word search is active the
 * releases it finds open themselves, since the words are inside, and close
 * again when the search is cleared. A release named in the address bar's
 * hash opens on arrival for the same reason.
 * @param props - See {@link ChangelogTimelineProps}.
 * @param props.packageName - Full npm package name
 * @param props.releases - Every release, newest first
 * @returns The controls, the notice, and the timeline.
 */
export function ChangelogTimeline({ packageName, releases }: ChangelogTimelineProps) {
  const [filter, setFilter] = useState<ChangelogFilter>(NO_CHANGELOG_FILTER)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  const visible = useMemo(() => filterReleases(releases, filter), [releases, filter])
  const searching = parseQuery(filter.query).terms.length > 0
  const steps = useMemo(() => {
    const byVersion: Record<string, ReleaseStep> = {}
    releases.forEach((release, index) => {
      byVersion[release.version] = releaseStep(release, releases[index + 1] ?? null)
    })
    return byVersion
  }, [releases])

  // why: a link straight to a release is a request to read it, so the release the hash names opens itself on arrival
  useEffect(() => {
    const open = (): void => {
      const hash = window.location.hash.slice(1)
      const target = releases.find((release) => releaseAnchor(release.version) === hash)
      if (target !== undefined) setToggled((current) => ({ ...current, [target.version]: true }))
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [releases])

  const onToggle = useCallback((version: string, open: boolean) => {
    setToggled((current) => ({ ...current, [version]: open }))
  }, [])

  return (
    <>
      <ChangelogFilterBar filter={filter} onChange={setFilter} resultCount={visible.length} totalCount={releases.length} />

      <NpmLatestNotice packageName={packageName} newestListed={releases[0]?.version ?? null} />

      {visible.length === 0 ? (
        <p className="mt-10 py-10 text-center text-slate-500 dark:text-slate-400">
          No release matches that. Try fewer words, or a wider range.
        </p>
      ) : (
        <ol className="changelog mt-8">
          {visible.map((release) => (
            <ReleaseEntry
              key={release.version}
              release={release}
              step={steps[release.version] ?? 'patch'}
              open={toggled[release.version] ?? searching}
              onToggle={onToggle}
            />
          ))}
        </ol>
      )}
    </>
  )
}

/** Props for {@link ReleaseEntry}. */
interface ReleaseEntryProps {
  /** The release */
  release: RenderedChangelogRelease
  /** How big a step it took */
  step: ReleaseStep
  /** Whether its notes are shown */
  open: boolean
  /** Called when the reader opens or closes it */
  onToggle: (version: string, open: boolean) => void
}

/**
 * One release on the rail.
 * @param props - See {@link ReleaseEntryProps}.
 * @param props.release - The release
 * @param props.step - How big a step it took
 * @param props.open - Whether its notes are shown
 * @param props.onToggle - Called when the reader opens or closes it
 * @returns The entry.
 */
function ReleaseEntry({ release, step, open, onToggle }: ReleaseEntryProps) {
  const summary = summarizeRelease(release)
  const counts = describeSummary(summary)
  const anchor = releaseAnchor(release.version)

  return (
    <li id={anchor} className="changelog__release scroll-mt-24" data-step={step} data-breaking={summary.breaking ? 'true' : undefined}>
      <details open={open} onToggle={(event) => onToggle(release.version, event.currentTarget.open)} className="changelog__details">
        <summary className="changelog__summary">
          <span className="changelog__marker" role="img" aria-label={STEP_LABELS[step]} />
          <span className="changelog__heading">
            <span className="changelog__version">v{release.version}</span>
            {release.date !== null ? (
              <time dateTime={release.date} className="changelog__date">
                {formatArticleDate(release.date)}
              </time>
            ) : null}
          </span>
          <span className="changelog__facts">
            {summary.breaking ? <span className="changelog__breaking">Breaking</span> : null}
            {counts.length > 0 ? <span className="changelog__counts">{counts.join(' · ')}</span> : null}
            {counts.length === 0 ? <span className="changelog__counts">No notes</span> : null}
          </span>
          <CaretIcon className="changelog__caret h-4 w-4" />
        </summary>

        <div className="changelog__body">
          {release.sections.map((section, index) => (
            <section key={`${section.heading}-${index}`} className="changelog__section" data-kind={section.kind}>
              {section.heading !== '' ? <h3 className="changelog__section-title">{section.heading}</h3> : null}
              <ul className="changelog__items">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="changelog__item">
                    {item.breaking ? <span className="changelog__item-breaking">Breaking</span> : null}
                    {item.scope !== null ? <code className="changelog__scope">{item.scope}</code> : null}
                    <span dangerouslySetInnerHTML={{ __html: item.html }} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {release.compareUrl !== null ? (
            <a href={release.compareUrl} target="_blank" rel="noopener noreferrer" className="changelog__compare">
              Compare the commits behind v{release.version} on GitHub ↗
            </a>
          ) : null}
        </div>
      </details>
    </li>
  )
}
