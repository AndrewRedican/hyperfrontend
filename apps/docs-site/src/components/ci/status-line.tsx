'use client'

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
