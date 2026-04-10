'use client'

import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'

interface HighlightMatchProps {
  /** The text to display, with optional highlighting */
  text: string
  /** The search query to highlight within the text */
  query: string
}

/**
 * Escapes special regex characters in a string
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Renders text with search query matches highlighted.
 * When query is empty or whitespace-only, renders plain text.
 * @param props - Component props
 * @param props.text - The text to display
 * @param props.query - The search query to highlight
 */
export function HighlightMatch({ text, query }: HighlightMatchProps) {
  const trimmed = query.trim()
  if (!trimmed) {
    return <>{text}</>
  }

  // escapeRegex ensures only safe literal characters are matched
  const regex = createRegExp(`(${escapeRegex(trimmed)})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
