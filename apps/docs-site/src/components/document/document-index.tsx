'use client'

import type { MarkdownSection } from '@/lib/slug'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { CONTENT_ANCHORS_EVENT } from './content-anchors'

/**
 * Distance below the viewport top, in pixels, at which a heading counts as
 * reached. The site header is 64px tall and headings carry `scroll-mt-20`, so
 * a heading the reader has just jumped to sits at 80px; the marker is placed
 * just past it, where a heading is unambiguously behind the reader.
 */
const REACHED_MARKER = 96

/** Props for {@link DocumentIndex}. */
export interface DocumentIndexProps {
  /** Sections in document order, with the anchor ids the page assigns them */
  sections: MarkdownSection[]
  /** Called when an entry is followed, so a disclosure holding the index can close itself */
  onNavigate?: () => void
}

/**
 * The list of a document's sections, tracking where the reader is in it.
 *
 * Entries are plain anchors, so a section is reachable before any script runs
 * and the browser's own smooth scrolling and history handling apply. Which
 * entry is highlighted is worked out from where the headings currently sit
 * rather than from an intersection ratio: reading the positions directly gives
 * the same answer scrolling up as scrolling down, needs no observer to be
 * re-registered when the anchors are attached late, and lands on the right
 * entry when the page is opened straight at a heading.
 * @param props - See {@link DocumentIndexProps}.
 * @param props.sections - Sections in document order
 * @param props.onNavigate - Called when an entry is followed
 * @returns The index, or nothing when no section resolves to a heading on the page.
 * @example
 * ```tsx
 * <DocumentIndex sections={extractMarkdownSections(markdown)} />
 * ```
 */
export function DocumentIndex({ sections, onNavigate }: DocumentIndexProps) {
  const [active, setActive] = useState('')
  const frameRef = useRef(0)

  const update = useCallback(() => {
    frameRef.current = 0

    let reached = ''
    let first = ''

    for (const { anchor } of sections) {
      const heading = document.getElementById(anchor)
      if (!heading) continue
      if (!first) first = anchor
      if (heading.getBoundingClientRect().top > REACHED_MARKER) break
      reached = anchor
    }

    // why: the last section is often too short to push its heading past the marker, so at the end of the document it is chosen by where the reader is rather than by where its heading is
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    if (atEnd) {
      for (const { anchor } of sections) {
        if (document.getElementById(anchor)) reached = anchor
      }
    }

    setActive(reached || first)
  }, [sections])

  useEffect(() => {
    const schedule = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', schedule)
    window.addEventListener(CONTENT_ANCHORS_EVENT, schedule)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', schedule)
      window.removeEventListener(CONTENT_ANCHORS_EVENT, schedule)
    }
  }, [update])

  if (sections.length === 0) return null

  return (
    <ul className="space-y-0.5 border-l border-slate-200 dark:border-slate-800">
      {sections.map((section) => {
        const isActive = section.anchor === active
        return (
          <li key={section.anchor}>
            <a
              href={`#${section.anchor}`}
              onClick={onNavigate}
              aria-current={isActive ? 'location' : undefined}
              className={`-ml-px block border-l py-1 text-sm leading-snug transition-colors ${section.level > 2 ? 'pl-6' : 'pl-3'} ${
                isActive
                  ? 'border-primary-600 font-medium text-primary-700 dark:border-primary-400 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-100'
              }`}
            >
              {section.title}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
