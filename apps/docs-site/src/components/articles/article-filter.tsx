'use client'

import type { FilterTerm } from '@/lib/article-filters'
import type { FocusEvent, KeyboardEvent } from 'react'
import { searchFilterTerms } from '@/lib/article-filters'
import { useCallback, useId, useMemo, useRef, useState } from 'react'

/** Props for {@link ArticleFilter}. */
export interface ArticleFilterProps {
  /** Every term the corpus offers */
  terms: FilterTerm[]
  /** Ids of the chosen terms, in the order they were chosen */
  selected: string[]
  /** Called with the new selection whenever it changes */
  onChange: (selected: string[]) => void
}

/**
 * One control that narrows the article index: type to find a category or a
 * tag, choose it, and it becomes a chip; choose more, and every chip must
 * match.
 *
 * A combobox in the ARIA sense: the text field owns a listbox of candidates,
 * moves a highlight through it with the arrow keys, takes the highlighted
 * candidate on Enter, and closes on Escape. Backspace on an empty field takes
 * the last chip off, and every chip carries its own remove button for the
 * pointer and for readers who tab to it. The candidates are the vocabulary
 * minus what is already chosen, so nothing can be chosen twice.
 *
 * With nothing chosen the control is a single quiet field, because an empty
 * selection means the whole index and needs no announcement. Chips wrap
 * inside the field on a phone rather than scrolling out of it.
 * @param props - See {@link ArticleFilterProps}.
 * @param props.terms - Every term the corpus offers
 * @param props.selected - Ids of the chosen terms
 * @param props.onChange - Called with the new selection
 * @returns The control.
 * @example
 * ```tsx
 * <ArticleFilter terms={collectFilterTerms(articles)} selected={selected} onChange={setSelected} />
 * ```
 */
export function ArticleFilter({ terms, selected, onChange }: ArticleFilterProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const labelId = useId()

  const candidates = useMemo(() => searchFilterTerms(terms, query, selected), [terms, query, selected])
  const chips = useMemo(() => selected.flatMap((id) => terms.filter((term) => term.id === id)), [selected, terms])
  const highlightedTerm = candidates[highlighted] ?? candidates[0]

  const choose = useCallback(
    (term: FilterTerm) => {
      onChange([...selected, term.id])
      setQuery('')
      setHighlighted(0)
      inputRef.current?.focus()
    },
    [onChange, selected]
  )

  const remove = useCallback(
    (id: string) => {
      onChange(selected.filter((chosen) => chosen !== id))
      inputRef.current?.focus()
    },
    [onChange, selected]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setOpen(true)
          setHighlighted((index) => (candidates.length === 0 ? 0 : (index + 1) % candidates.length))
          return
        case 'ArrowUp':
          event.preventDefault()
          setOpen(true)
          setHighlighted((index) => (candidates.length === 0 ? 0 : (index - 1 + candidates.length) % candidates.length))
          return
        case 'Enter':
          if (open && highlightedTerm) {
            event.preventDefault()
            choose(highlightedTerm)
          }
          return
        case 'Escape':
          if (open) {
            event.preventDefault()
            setOpen(false)
          }
          return
        case 'Backspace':
          if (query === '' && selected.length > 0) {
            remove(selected[selected.length - 1])
          }
          return
        default:
          return
      }
    },
    [candidates.length, choose, highlightedTerm, open, query, remove, selected]
  )

  // why: the listbox is part of the control, so focus moving between the field, a chip's remove button and an option is not leaving; only focus landing outside the whole control closes it
  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!rootRef.current?.contains(event.relatedTarget)) {
      setOpen(false)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative" onBlur={handleBlur}>
      <span id={labelId} className="sr-only">
        Filter articles by category or tag
      </span>
      {/* why: the border belongs to the whole field, chips included, and a click anywhere in it goes to the text input, which is what makes the chips read as being inside one control */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm transition-colors focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
      >
        <FilterIcon className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
        {chips.map((term) => (
          <span
            key={term.id}
            className="inline-flex items-center gap-1 rounded-full bg-primary-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary-800 dark:bg-primary-900/50 dark:text-primary-200"
          >
            {term.value}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                remove(term.id)
              }}
              aria-label={`Remove ${term.value}`}
              className="rounded-full p-0.5 text-primary-600 transition-colors hover:bg-primary-200 hover:text-primary-900 dark:text-primary-300 dark:hover:bg-primary-800 dark:hover:text-white"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && highlightedTerm ? optionId(listId, highlightedTerm) : undefined}
          autoComplete="off"
          value={query}
          placeholder={selected.length === 0 ? 'Filter by category or tag' : 'Add another'}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlighted(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white"
        />
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChange([])
              inputRef.current?.focus()
            }}
            className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Clear
          </button>
        ) : null}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        aria-multiselectable="true"
        hidden={!open}
        className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        {candidates.length === 0 ? (
          <li className="px-3 py-2 text-slate-500 dark:text-slate-400" role="presentation">
            {terms.length === selected.length ? 'Every term is selected' : `Nothing matches "${query}"`}
          </li>
        ) : (
          candidates.map((term, index) => (
            <li
              key={term.id}
              id={optionId(listId, term)}
              role="option"
              aria-selected={term === highlightedTerm}
              // why: mousedown rather than click, and prevented, so choosing an option with the pointer never blurs the field and closes the list under the click
              onMouseDown={(event) => {
                event.preventDefault()
                choose(term)
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${
                term === highlightedTerm
                  ? 'bg-primary-50 text-primary-900 dark:bg-primary-950/50 dark:text-primary-100'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{term.value}</span>
              <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{term.kind}</span>
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">{term.count}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

/**
 * The id of a term's option, so the field can point at it.
 * @param listId - The listbox's id
 * @param term - The term
 * @returns A document-unique id
 */
function optionId(listId: string, term: FilterTerm): string {
  return `${listId}-${term.id.replace(/[^a-z0-9]+/gi, '-')}`
}

/** Props for the inline icons. */
interface IconProps {
  /** Sizing and colour classes */
  className?: string
}

function FilterIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
      />
    </svg>
  )
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}
