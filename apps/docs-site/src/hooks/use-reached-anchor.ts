'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { CONTENT_ANCHORS_EVENT } from '../components/document/content-anchors'

/**
 * Distance below the viewport top, in pixels, at which an anchored element
 * counts as reached. The site header is 64px tall and anchored headings carry
 * `scroll-mt-20`, so an element the reader has just jumped to sits at 80px;
 * the marker is placed just past it, where the element is unambiguously
 * behind the reader.
 */
const REACHED_MARKER = 96

/**
 * Which of a page's anchored sections the reader is currently in.
 *
 * The answer is worked out from where the anchored elements currently sit
 * rather than from an intersection ratio: reading the positions directly
 * gives the same answer scrolling up as scrolling down, needs no observer to
 * be re-registered when anchors are attached late, and lands on the right
 * entry when the page is opened straight at one. The last anchor is often too
 * short a section to push its element past the marker, so at the end of the
 * document it is chosen by where the reader is rather than by where the
 * element is.
 *
 * Shared by every navigation that tracks a reading position, so a document's
 * index and an article listing's year rail highlight by one rule.
 *
 * @param anchors - Element ids in document order
 * @returns The id of the anchor the reader has reached, or the first that exists when none has been
 * @example Highlighting the year a reader is scrolled to
 * ```tsx
 * const active = useReachedAnchor(years.map(yearAnchor))
 * ```
 */
export function useReachedAnchor(anchors: readonly string[]): string {
  const [active, setActive] = useState('')
  const frameRef = useRef(0)

  const update = useCallback(() => {
    frameRef.current = 0

    let reached = ''
    let first = ''

    for (const anchor of anchors) {
      const element = document.getElementById(anchor)
      if (!element) continue
      if (!first) first = anchor
      if (element.getBoundingClientRect().top > REACHED_MARKER) break
      reached = anchor
    }

    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    if (atEnd) {
      for (const anchor of anchors) {
        if (document.getElementById(anchor)) reached = anchor
      }
    }

    setActive(reached || first)
  }, [anchors])

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

  return active
}
