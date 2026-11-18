/**
 * How a document-level action is drawn, shared by the actions every document offers and the ones a single kind of document adds, so the column reads as one list.
 *
 * @module
 */

/**
 * Shared chrome for every action: a quiet text row that only picks up a
 * background on hover, so the group reads as a list of verbs rather than as a
 * panel of buttons.
 */
export const ACTION_CLASSES =
  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
