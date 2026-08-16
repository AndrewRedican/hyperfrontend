const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * Format an ISO article date for display.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns Human-readable date (e.g., "July 22, 2026"), or the input when it is not in the expected format
 */
export function formatArticleDate(date: string): string {
  const [year, month, day] = date.split('-')
  const monthName = MONTH_NAMES[Number(month) - 1]

  if (!year || !monthName || !day) {
    return date
  }

  return `${monthName} ${Number(day)}, ${year}`
}

/**
 * Split a comma-separated frontmatter scalar into a trimmed list.
 *
 * The article frontmatter format is deliberately flat, so list-valued fields
 * are carried as one quoted comma-separated scalar. A value that needs a
 * literal comma cannot be a list field.
 *
 * @param value - Raw frontmatter value, possibly undefined
 * @returns The trimmed non-empty entries, in order
 */
export function splitList(value: string | undefined): string[] {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}
