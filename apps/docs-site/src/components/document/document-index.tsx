'use client'

import type { MarkdownSection } from '@/lib/slug'
import { useEffect, useId, useMemo, useState } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { useReachedAnchor } from '../../hooks/use-reached-anchor'
import { CaretIcon } from './document-icons'
import { ACTIVE_EDGE, ACTIVE_TEXT, INACTIVE_TEXT, RAIL } from './rail-styles'

/** A top-level entry, with the subsections filed beneath it. */
interface IndexGroup {
  /** The top-level section itself */
  section: MarkdownSection
  /** Its subsections, in document order */
  children: MarkdownSection[]
}

/**
 * File each subsection under the top-level section that precedes it.
 *
 * A document that opens with a subsection has nothing to file it under, so it
 * becomes a childless group of its own rather than being dropped.
 * @param sections - Sections in document order
 * @returns One group per top-level section
 */
function groupSections(sections: MarkdownSection[]): IndexGroup[] {
  const groups: IndexGroup[] = []

  for (const section of sections) {
    const current = groups[groups.length - 1]
    if (section.level > 2 && current) {
      current.children.push(section)
    } else {
      groups.push({ section, children: [] })
    }
  }

  return groups
}

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
 * entry is highlighted is the reading position {@link useReachedAnchor}
 * tracks, worked out from where the headings currently sit.
 *
 * Subsections stay folded under the section that owns them, and the one group
 * the reader is currently inside opens. A reference document can carry thirty
 * headings, most of them repeating `Purpose` and `Example` under each entry
 * point, and listing all of them at once buries the shape of the document in
 * its own detail. Because the open group follows the same reading position the
 * highlight does, arriving at a subsection by scrolling and arriving at one
 * from a link in the address bar need no separate handling: both set the
 * position, and the group opens.
 * @param props - See {@link DocumentIndexProps}.
 * @param props.sections - Sections in document order
 * @param props.onNavigate - Called when an entry is followed
 * @returns The index, or nothing when there are no sections.
 * @example
 * ```tsx
 * <DocumentIndex sections={extractMarkdownSections(markdown)} />
 * ```
 */
export function DocumentIndex({ sections, onNavigate }: DocumentIndexProps) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const baseId = useId()

  const groups = useMemo(() => groupSections(sections), [sections])
  const anchors = useMemo(() => sections.map((section) => section.anchor), [sections])
  const active = useReachedAnchor(anchors)

  // why: the highlight lands on whichever entry the reader has reached, and the group that opens is the one owning it, so a subsection and its parent are the same answer
  const ownerOf = useMemo(() => {
    const owners = createMap<string, string>()
    for (const group of groups) {
      owners.set(group.section.anchor, group.section.anchor)
      for (const child of group.children) owners.set(child.anchor, group.section.anchor)
    }
    return owners
  }, [groups])

  const activeGroup = ownerOf.get(active) ?? ''

  useEffect(() => {
    // why: leaving a group's subsections folds them again, and a group the reader opened by hand is a decision about where they were, not a preference to carry along
    setOverrides((current) => (keys(current).length > 0 ? {} : current))
  }, [activeGroup])

  if (groups.length === 0) return null

  return (
    <ul className={`space-y-0.5 ${RAIL}`}>
      {groups.map(({ section, children }) => {
        const panelId = `${baseId}-${section.anchor}`
        const open = overrides[section.anchor] ?? section.anchor === activeGroup

        return (
          <li key={section.anchor}>
            <div className={`-ml-px flex items-center border-l ${section.anchor === active ? ACTIVE_EDGE : 'border-transparent'}`}>
              <a
                href={`#${section.anchor}`}
                onClick={onNavigate}
                aria-current={section.anchor === active ? 'location' : undefined}
                className={`min-w-0 flex-1 py-1 pl-3 text-sm leading-snug transition-colors ${section.anchor === active ? ACTIVE_TEXT : INACTIVE_TEXT}`}
              >
                {section.title}
              </a>

              {children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setOverrides((current) => ({ ...current, [section.anchor]: !open }))}
                  aria-expanded={open}
                  aria-controls={panelId}
                  aria-label={`${open ? 'Collapse' : 'Expand'} ${section.title}`}
                  className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-100"
                >
                  <CaretIcon className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>
              ) : null}
            </div>

            {children.length > 0 ? (
              <ul id={panelId} hidden={!open} className="space-y-0.5 pt-0.5">
                {children.map((child) => (
                  <li key={child.anchor}>
                    <a
                      href={`#${child.anchor}`}
                      onClick={onNavigate}
                      aria-current={child.anchor === active ? 'location' : undefined}
                      className={`-ml-px block border-l py-1 pl-6 text-sm leading-snug transition-colors ${
                        child.anchor === active ? `${ACTIVE_EDGE} ${ACTIVE_TEXT}` : `border-transparent ${INACTIVE_TEXT}`
                      }`}
                    >
                      {child.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
