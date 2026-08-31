'use client'

import type { DocumentDescriptor } from '@/lib/document-model'
import type { MarkdownSection } from '@/lib/slug'
import type { ReactNode } from 'react'
import { MIN_INDEX_SECTIONS } from '@/lib/document-model'
import { navVisibility } from '@/lib/nav-visibility'
import { useId, useState } from 'react'
import { DocumentActions } from './document-actions'
import { CaretIcon, ListIcon } from './document-icons'
import { DocumentIndex } from './document-index'

/** Props for {@link DocumentShell}. */
export interface DocumentShellProps {
  /** The document the actions act on; omitted when the document has no published Markdown counterpart */
  descriptor?: DocumentDescriptor
  /** Sections in document order; fewer than {@link MIN_INDEX_SECTIONS} of them and no index is shown */
  sections?: MarkdownSection[]
  /** Actions replacing the standard set, for a document that cannot offer them */
  actions?: ReactNode
  /** One line explaining why this document's companion differs from every other one's */
  note?: string
  /** The document itself */
  children: ReactNode
}

/**
 * The layout every long-form document on this site is rendered in: the
 * document, and a companion carrying its index and its document-level actions.
 *
 * One shell serves package pages, architecture documents, secondary entry
 * points, guides, articles, and the republished workspace documents, so the
 * index behaves identically on all of them and a new document type gets the
 * whole capability by being wrapped in it.
 *
 * The companion is a floating column from {@link navVisibility.documentRail}
 * up and a disclosure above the document below it. Three columns are not
 * squeezed into a tablet: at those widths the left navigation and a readable
 * measure already account for the screen, so the companion folds into a single
 * control that holds exactly what the column holds.
 * @param props - See {@link DocumentShellProps}.
 * @param props.descriptor - The document the actions act on
 * @param props.sections - Sections in document order
 * @param props.actions - Actions replacing the standard set
 * @param props.note - One line explaining a variant's difference
 * @param props.children - The document itself
 * @returns The document beside its companion.
 * @example
 * ```tsx
 * <DocumentShell descriptor={descriptor} sections={extractMarkdownSections(markdown)}>
 *   <ReadmeContent html={html} mermaidDiagrams={diagrams} />
 * </DocumentShell>
 * ```
 */
export function DocumentShell({ descriptor, sections = [], actions, note, children }: DocumentShellProps) {
  const indexed = sections.length >= MIN_INDEX_SECTIONS ? sections : []
  const companion = actions ?? (descriptor ? <DocumentActions descriptor={descriptor} /> : null)

  if (indexed.length === 0 && !companion && !note) {
    return <>{children}</>
  }

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <DocumentToolbar sections={indexed} companion={companion} note={note} />
        {children}
      </div>

      <aside className={`${navVisibility.documentRail} w-52 shrink-0 print:hidden`} aria-label="Document tools">
        {/* why: no border and no fill, so the column reads as a margin note beside the document rather than as a second panel competing with it */}
        <div className="sticky top-20 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pb-10 pt-1">
          {indexed.length > 0 ? (
            <nav aria-label="On this page">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">On this page</p>
              <DocumentIndex sections={indexed} />
            </nav>
          ) : null}

          {companion || note ? (
            <div className={indexed.length > 0 ? 'mt-6 border-t border-slate-200 pt-4 dark:border-slate-800' : ''}>
              {companion}
              {note ? <p className="px-2 pt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">{note}</p> : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

/** Props for the folded companion shown below the rail breakpoint. */
interface DocumentToolbarProps {
  /** Sections to list, empty when the document is too short to index */
  sections: MarkdownSection[]
  /** The action list, already resolved */
  companion: ReactNode
  /** One line explaining a variant's difference */
  note?: string
}

/**
 * The companion, folded into one disclosure for widths that cannot carry it as
 * a column.
 * @param props - See {@link DocumentToolbarProps}.
 * @param props.sections - Sections to list
 * @param props.companion - The action list
 * @param props.note - One line explaining a variant's difference
 * @returns The disclosure and its panel.
 */
function DocumentToolbar({ sections, companion, note }: DocumentToolbarProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const label = sections.length > 0 ? 'On this page' : 'Document actions'

  return (
    <div className={`${navVisibility.documentToolbar} mb-6 border-b border-slate-200 pb-2 dark:border-slate-800 print:hidden`}>
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={panelId}
        className="-ml-2 flex min-h-[36px] items-center gap-2 rounded-md px-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <ListIcon className="h-4 w-4" />
        {label}
        <CaretIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div id={panelId} hidden={!open} className="pb-2 pt-1">
        {sections.length > 0 ? (
          <nav aria-label="On this page">
            <DocumentIndex sections={sections} onNavigate={() => setOpen(false)} />
          </nav>
        ) : null}
        {companion || note ? (
          <div className={sections.length > 0 ? 'mt-4 border-t border-slate-200 pt-3 dark:border-slate-800' : ''}>
            {companion}
            {note ? <p className="px-2 pt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">{note}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
