'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createObjectURL, revokeObjectURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { generateSlug } from '../../lib/markdown'
import { CaretIcon, DownloadIcon, PrintIcon } from '../document/document-icons'

/** Props for {@link RecordActions}. */
export interface RecordActionsProps {
  /** Builds the Markdown record under a given name, so the name chosen in the dialog is the one that gets saved. */
  buildRecord: (label: string) => string
  /** ISO date the record was generated, used for the filename when it has no name. */
  generatedOn: string
  /** Name already stored with the assessment, offered as the dialog's starting value. */
  label: string
  /** Persists a name the reader entered, so it survives a reload. */
  onLabel: (label: string) => void
}

/** Props for the naming dialog. */
interface NameDialogProps {
  /** Current draft name. */
  value: string
  /** Reports each keystroke. */
  onChange: (value: string) => void
  /** Saves under the current draft. */
  onConfirm: () => void
  /** Dismisses without saving. */
  onCancel: () => void
}

/**
 * The record's one control: save the document as Markdown or as PDF.
 *
 * Both outputs are the same record in different containers, so they belong
 * behind one verb rather than competing as two buttons. Markdown asks for a
 * name first, since a file needs one and a printed page does not.
 * @param props - See {@link RecordActionsProps}.
 * @param props.buildRecord
 * @param props.generatedOn
 * @param props.label
 * @param props.onLabel
 * @returns The dropdown and its naming dialog.
 * @example
 * ```tsx
 * <RecordActions buildRecord={render} generatedOn="2026-08-30" label="" onLabel={setLabel} />
 * ```
 */
export function RecordActions({ buildRecord, generatedOn, label, onLabel }: RecordActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [draft, setDraft] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Node && !menuRef.current?.contains(target)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const chooseMarkdown = useCallback(() => {
    setMenuOpen(false)
    setDraft(label)
    setNaming(true)
  }, [label])

  const choosePdf = useCallback(() => {
    setMenuOpen(false)
    window.print()
  }, [])

  const save = useCallback(() => {
    const name = draft.trim()
    setNaming(false)
    onLabel(name)
    const url = createObjectURL(new Blob([buildRecord(name)], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${name ? generateSlug(name) : `decision-record-${generatedOn}`}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    revokeObjectURL(url)
  }, [buildRecord, draft, generatedOn, onLabel])

  return (
    <div ref={menuRef} className="relative shrink-0 print:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Save as
        <CaretIcon className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <MenuItem onClick={chooseMarkdown} icon={<DownloadIcon className="h-4 w-4" />}>
            Markdown
          </MenuItem>
          <MenuItem onClick={choosePdf} icon={<PrintIcon className="h-4 w-4" />}>
            PDF
          </MenuItem>
        </div>
      ) : null}

      {naming
        ? createPortal(<NameDialog value={draft} onChange={setDraft} onConfirm={save} onCancel={() => setNaming(false)} />, document.body)
        : null}
    </div>
  )
}

/** Props for one dropdown entry. */
interface MenuItemProps {
  /** What choosing it does. */
  onClick: () => void
  /** The mark for the format, drawn from the shared document icon set so this menu reads like every other document control on the site. */
  icon: ReactNode
  /** The format name. */
  children: string
}

/**
 * One format in the save menu.
 * @param props - See {@link MenuItemProps}.
 * @param props.onClick
 * @param props.icon
 * @param props.children
 * @returns The menu entry.
 */
function MenuItem({ onClick, icon, children }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {icon}
      {children}
    </button>
  )
}

/**
 * Asks for a name before the record leaves the page.
 *
 * Naming is offered at the moment it matters rather than demanded on arrival,
 * and skipping is a first-class answer: the file still gets a dated name.
 * @param props - See {@link NameDialogProps}.
 * @param props.value
 * @param props.onChange
 * @param props.onConfirm
 * @param props.onCancel
 * @returns The dialog.
 */
function NameDialog({ value, onChange, onConfirm, onCancel }: NameDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      ref={backdropRef}
      onClick={(event) => {
        if (event.target === backdropRef.current) onCancel()
      }}
      className="fixed inset-0 z-[160] flex items-start justify-center bg-slate-900/50 p-4 pt-[18vh] backdrop-blur-sm"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-record-title"
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="name-record-title" className="text-base font-bold text-slate-900 dark:text-white">
          Name this record
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Optional. The name titles the document and names the file it is saved as.
        </p>
        <input
          // why: the dialog exists to collect this one field, and the reader opened it deliberately
          autoFocus
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Checkout platform, Q3"
          className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
        />
        <div className="mt-5 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            {value.trim() ? 'Download' : 'Skip and download'}
          </button>
        </div>
      </form>
    </div>
  )
}
