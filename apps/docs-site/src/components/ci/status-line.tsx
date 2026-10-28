'use client'

import { readToken, writeToken } from '@/lib/ci/fetch'
import { useEffect, useState } from 'react'

/** What a page says under its toolbar. */
export interface Status {
  /** The text, or null for nothing */
  message: string | null
  /** Whether the text is an error */
  error: boolean
}

/** Props for {@link StatusLine}. */
export interface StatusLineProps {
  /** What the page is doing or what went wrong, or null when nothing needs saying */
  message: string | null
  /** Whether the message is an error */
  error?: boolean
}

/**
 * One line under a toolbar: what the page is loading, or why it could not.
 * @param props - See {@link StatusLineProps}.
 * @param props.message - The text
 * @param props.error - Whether it is an error
 * @returns The line, or nothing
 */
export function StatusLine({ message, error = false }: StatusLineProps) {
  if (message === null) return null
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`mt-3 text-sm ${error ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400'}`}
    >
      {message}
    </p>
  )
}

/** Props for {@link TokenField}. */
export interface TokenFieldProps {
  /** Called with the token the reader kept, or null when they forgot it */
  onChange: (token: string | null) => void
  /** The requests GitHub said were left in the hour, or null */
  remaining: number | null
}

/**
 * The optional GitHub token a reader may give to refresh faster: kept in their own browser,
 * sent to GitHub alone, never to this site.
 * @param props - See {@link TokenFieldProps}.
 * @param props.onChange - Told when the token changes
 * @param props.remaining - The rate limit left
 * @returns The field, folded by default
 */
export function TokenField({ onChange, remaining }: TokenFieldProps) {
  const [draft, setDraft] = useState('')
  const [kept, setKept] = useState(false)

  useEffect(() => {
    const token = readToken()
    setKept(token !== null)
    onChange(token)
  }, [onChange])

  return (
    <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
      <summary className="cursor-pointer font-medium text-slate-900 dark:text-white">
        GitHub token (optional){kept ? ': one is kept in this browser' : ''}
        {remaining === null ? '' : ` · ${remaining} requests left this hour`}
      </summary>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Without a token this page reads every few minutes; a fine-grained token with no permissions lets it read every minute. It stays in
        this browser and is sent only to GitHub.
      </p>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          writeToken(draft)
          setKept(draft.trim() !== '')
          onChange(draft.trim() === '' ? null : draft.trim())
          setDraft('')
        }}
      >
        <input
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="github_pat_…"
          aria-label="GitHub token"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
        />
        <button type="submit" className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700">
          Keep
        </button>
        <button
          type="button"
          onClick={() => {
            writeToken(null)
            setKept(false)
            onChange(null)
          }}
          className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Forget
        </button>
      </form>
    </details>
  )
}

/** Props for {@link Toggle}. */
export interface ToggleProps {
  /** The text */
  label: string
  /** Whether it is on */
  on: boolean
  /** Flips it */
  onToggle: () => void
  /** A swatch colour, or null */
  swatch?: string | null
  /** The dash pattern of the swatch, or null for solid */
  dash?: string | null
}

/**
 * A toggle drawn as a chip, with a swatch of the line it governs.
 * @param props - See {@link ToggleProps}.
 * @param props.label - The text
 * @param props.on - Whether it is on
 * @param props.onToggle - Flips it
 * @param props.swatch - The colour of its line
 * @param props.dash - The dash pattern of its line
 * @returns The chip
 */
export function Toggle({ label, on, onToggle, swatch = null, dash = null }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        on
          ? 'border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-white'
          : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
      }`}
    >
      {swatch === null ? null : (
        <svg aria-hidden="true" width="18" height="6" className="shrink-0">
          <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" stroke={swatch} strokeDasharray={dash ?? undefined} opacity={on ? 1 : 0.4} />
        </svg>
      )}
      {label}
    </button>
  )
}
