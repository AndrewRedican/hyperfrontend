'use client'

import type { SearchDocument, SearchIndex } from '@/lib/search/search-contract'
import { trackSearchOpen } from '@/lib/analytics-events'
import { SEARCH_INDEX_PATH } from '@/lib/search/search-contract'
import { search } from '@/lib/search/search-engine'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

type IconProps = { className?: string }

const KIND_LABELS = {
  page: 'Page',
  library: 'Library',
  submodule: 'Module',
  architecture: 'Architecture',
  guide: 'Guide',
  article: 'Article',
  api: 'API',
} as const

// why: The index is fetched once per page life, on first open, and shared by every subsequent search
let indexPromise: Promise<SearchDocument[]> | null = null

function loadIndex(): Promise<SearchDocument[]> {
  if (!indexPromise) {
    indexPromise = fetch(SEARCH_INDEX_PATH)
      .then((response) => {
        if (!response.ok) throw createError(`search index request failed: ${response.status}`)
        return response.json()
      })
      .then((index: SearchIndex) => {
        if (index.schemaVersion !== 1) throw createError(`unsupported search index version: ${index.schemaVersion}`)
        return index.documents
      })
      .catch((error: Error) => {
        indexPromise = null
        throw error
      })
  }
  return indexPromise
}

/**
 * Site-wide search: a keyboard-first dialog over the build-time search index.
 *
 * Opens from the header button or Ctrl/Cmd+K, fetches the static index lazily
 * on first open, and matches deterministically (exact substring, AND
 * semantics, no fuzziness).
 * @returns The search trigger button and its dialog portal
 */
export function SearchControl() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((wasOpen) => !wasOpen)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      trackSearchOpen()
    }
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search documentation"
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
      >
        <SearchIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500 md:inline">
          ⌘K
        </kbd>
      </button>
      {mounted && open ? createPortal(<SearchDialog onClose={close} />, document.body) : null}
    </>
  )
}

interface SearchDialogProps {
  /** Closes the dialog and restores focus to the trigger */
  onClose: () => void
}

function SearchDialog({ onClose }: SearchDialogProps) {
  const [documents, setDocuments] = useState<SearchDocument[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadIndex()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const results = useMemo(() => (documents ? search(documents, query) : []), [documents, query])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    document.getElementById(`search-result-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((current) => (results.length === 0 ? 0 : (current + 1) % results.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((current) => (results.length === 0 ? 0 : (current - 1 + results.length) % results.length))
    } else if (event.key === 'Enter') {
      const target = results[selected]
      if (target) {
        event.preventDefault()
        // why: Assigning location handles both route and same-page hash destinations without router juggling
        window.location.assign(target.href)
        onClose()
      }
    } else if (event.key === 'Tab') {
      trapFocus(event)
    }
  }

  /**
   * Keeps Tab inside the dialog by cycling the real focusable descendants,
   * so every result link and the failure fallback stay keyboard reachable.
   * @param event - The keyboard event carrying the Tab press
   */
  function trapFocus(event: React.KeyboardEvent) {
    // why: Result links are reached with the arrow keys, not Tab (they carry tabIndex -1), so the trap must cycle only the genuinely tabbable stops
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href]:not([tabindex="-1"]), button:not([disabled]), input')
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={backdropRef}
      onMouseDown={(event) => {
        if (event.target === backdropRef.current) onClose()
      }}
      className="fixed inset-0 z-[160] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh] backdrop-blur-sm sm:pt-[18vh]"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
          <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={results.length > 0 ? `search-result-${selected}` : undefined}
            aria-label="Search documentation"
            placeholder="Search guides, packages, APIs, articles…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white dark:placeholder-slate-500"
          />
        </div>

        <div id="search-results" role="listbox" aria-label="Search results" className="max-h-[50vh] overflow-y-auto overscroll-contain">
          {loadFailed ? (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              Search is unavailable right now. Try the{' '}
              <Link href="/docs" className="text-primary-600 hover:underline dark:text-primary-400" onClick={onClose}>
                docs sidebar
              </Link>{' '}
              instead.
            </p>
          ) : query.trim() === '' ? (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              Type to search every guide, package page, API symbol, and article.
            </p>
          ) : documents === null ? (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Loading the index…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No matches. Search is exact: try a shorter term.</p>
          ) : (
            <div className="py-2">
              {results.map((result, resultIndex) => (
                <div key={result.href} role="option" aria-selected={resultIndex === selected} id={`search-result-${resultIndex}`}>
                  <Link
                    href={result.href}
                    tabIndex={-1}
                    onClick={onClose}
                    onMouseEnter={() => setSelected(resultIndex)}
                    className={`flex min-h-[44px] items-center gap-3 px-4 py-2.5 ${
                      resultIndex === selected ? 'bg-primary-50 dark:bg-primary-950/40' : ''
                    }`}
                  >
                    <span className="w-20 shrink-0 text-right text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {KIND_LABELS[result.kind]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{result.title}</span>
                      {result.context ? (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{result.context}</span>
                      ) : null}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                event.preventDefault()
                inputRef.current?.focus()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
            className="rounded px-2 py-1 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  )
}
