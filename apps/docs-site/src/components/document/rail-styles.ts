/**
 * How a navigation rail draws its entries, shared by the document index and the article listing's years so both are one family of control.
 *
 * @module
 */

/** The guide line every entry hangs off. */
export const RAIL = 'border-l border-slate-200 dark:border-slate-800'

/** Left edge drawn over the guide rail for the entry the reader has reached. */
export const ACTIVE_EDGE = 'border-primary-600 dark:border-primary-400'

/** Type treatment for that entry. */
export const ACTIVE_TEXT = 'font-medium text-primary-700 dark:text-primary-300'

/** Type treatment for every other entry, which picks up the rail on hover. */
export const INACTIVE_TEXT = 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
