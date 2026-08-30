'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { AnchorLink } from '../anchor-link'

/** Props for {@link RecordSection}. */
export interface RecordSectionProps {
  /** Anchor id. The section is addressable at `#<id>` and opens itself when linked to. */
  id: string
  /** Section heading. */
  title: string
  /** Whether the section starts open. Set on the sections that carry the answer, so the record reads without a click. */
  defaultOpen?: boolean
  /** Section body. */
  children: ReactNode
}

/** Props for the expand and collapse glyph. */
interface ToggleIconProps {
  /** Whether the section is open, which decides plus or minus. */
  open: boolean
  /** Sizing and colour classes. */
  className?: string
}

/**
 * One collapsible, linkable section of the record.
 *
 * The sections that answer the question start open and the supporting working
 * starts closed, so the record reads as a result with its evidence filed
 * behind it. Each one carries an anchor: a link someone saved to a section
 * lands on it and opens it. The body stays in the document while closed, so
 * find-in-page and printing still reach it.
 * @param props - See {@link RecordSectionProps}.
 * @param props.id
 * @param props.title
 * @param props.defaultOpen
 * @param props.children
 * @returns The section.
 * @example
 * ```tsx
 * <RecordSection id="recorded-answers" title="Recorded answers">{table}</RecordSection>
 * ```
 */
export function RecordSection({ id, title, defaultOpen = false, children }: RecordSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const openWhenAddressed = () => {
      if (window.location.hash !== `#${id}`) return
      setOpen(true)
      // why: the panel has to be laid out before the browser can scroll to it, so the scroll waits a frame
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
    openWhenAddressed()
    window.addEventListener('hashchange', openWhenAddressed)
    return () => window.removeEventListener('hashchange', openWhenAddressed)
  }, [id])

  const toggle = useCallback(() => setOpen((current) => !current), [])

  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200 py-4 dark:border-slate-800">
      <h2 className="group flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left text-lg font-bold text-slate-900 transition-colors hover:bg-slate-50 dark:text-white dark:hover:bg-slate-900/60"
        >
          <ToggleIcon
            open={open}
            className="h-5 w-5 shrink-0 rounded border border-slate-300 p-0.5 text-slate-500 transition-colors group-hover:border-primary-500 group-hover:text-primary-600 dark:border-slate-600 dark:text-slate-400 dark:group-hover:border-primary-400 dark:group-hover:text-primary-300"
          />
          <span className="min-w-0">{title}</span>
        </button>
        <AnchorLink id={id} />
      </h2>
      <div id={`${id}-panel`} hidden={!open} className="mt-3 px-2">
        {children}
      </div>
    </section>
  )
}

function ToggleIcon({ open, className }: ToggleIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className={className}>
      <path strokeLinecap="round" d="M3.5 8h9" />
      {open ? null : <path strokeLinecap="round" d="M8 3.5v9" />}
    </svg>
  )
}
