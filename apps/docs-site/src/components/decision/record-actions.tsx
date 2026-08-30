'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** Props for {@link RecordActions}. */
export interface RecordActionsProps {
  /** Builds the Markdown record under a given name, so the name chosen in the dialog is the one that gets copied. */
  buildRecord: (label: string) => string
  /** Name already stored with the assessment, offered as the dialog's starting value. */
  label: string
  /** Persists a name the reader entered, so it survives a reload. */
  onLabel: (label: string) => void
}

/** Props for one action control. */
interface ActionProps {
  /** Leading icon. */
  icon: ReactNode
  /** Action label. */
  children: ReactNode
  /** What the action does. */
  onClick: () => void
  /** Rail actions stack the label under the icon; inline actions sit beside it. */
  rail?: boolean
}

/** Props for the naming dialog. */
interface NameDialogProps {
  /** Current draft name. */
  value: string
  /** Reports each keystroke. */
  onChange: (value: string) => void
  /** Copies under the current draft. */
  onConfirm: () => void
  /** Dismisses without copying. */
  onCancel: () => void
}

/**
 * The record's two actions, kept in view without taking space from the record.
 *
 * On wide screens they sit in the empty gutter beside the content; below that
 * they hold the bottom edge, where a phone reader's thumb already is. Neither
 * placement draws a container: the actions are chrome for the document, not
 * part of it, and they never print.
 * @param props - See {@link RecordActionsProps}.
 * @param props.buildRecord
 * @param props.label
 * @param props.onLabel
 * @returns The action rail, the mobile bar, and the naming dialog.
 * @example
 * ```tsx
 * <RecordActions buildRecord={(name) => render(name)} label="" onLabel={setLabel} />
 * ```
 */
export function RecordActions({ buildRecord, label, onLabel }: RecordActionsProps) {
  const [naming, setNaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const openNaming = useCallback(() => {
    setDraft(label)
    setNaming(true)
  }, [label])

  const confirm = useCallback(() => {
    const name = draft.trim()
    setNaming(false)
    onLabel(name)
    void navigator.clipboard?.writeText(buildRecord(name)).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setCopied(false)
    )
  }, [buildRecord, draft, onLabel])

  const print = useCallback(() => {
    window.print()
  }, [])

  const actions = (rail: boolean) => (
    <>
      <Action rail={rail} onClick={openNaming} icon={copied ? <TickIcon className="h-5 w-5" /> : <CopyIcon className="h-5 w-5" />}>
        {copied ? 'Copied' : 'Copy as Markdown'}
      </Action>
      <Action rail={rail} onClick={print} icon={<PrinterIcon className="h-5 w-5" />}>
        Save as PDF
      </Action>
    </>
  )

  return (
    <>
      {/* why: the gutter beside the content column is empty at this width, so the actions can stay put without ever covering the record */}
      <div className="fixed right-2 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-7 min-[1400px]:flex print:hidden">
        {actions(true)}
      </div>

      {/* why: no gutter exists on a phone, so the actions hold the bottom edge over a scrim rather than scrolling out of reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-end gap-6 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-4 pt-8 dark:from-slate-950 dark:via-slate-950/95 min-[1400px]:hidden print:hidden">
        {actions(false)}
      </div>

      {naming
        ? createPortal(
            <NameDialog value={draft} onChange={setDraft} onConfirm={confirm} onCancel={() => setNaming(false)} />,
            document.body
          )
        : null}
    </>
  )
}

/**
 * One action, drawn as bare icon and label with no container of its own.
 * @param props - See {@link ActionProps}.
 * @param props.icon
 * @param props.children
 * @param props.onClick
 * @param props.rail
 * @returns The control.
 */
function Action({ icon, children, onClick, rail }: ActionProps) {
  const shared = 'text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        rail
          ? `flex w-16 flex-col items-center gap-1.5 text-center text-[11px] font-medium leading-tight ${shared}`
          : `inline-flex items-center gap-2 text-xs font-medium ${shared}`
      }
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
 * and skipping is a first-class answer: a record pasted into a document is
 * usually already in a context that names it.
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
          Optional. A name is what makes the record identifiable once it is pasted somewhere else.
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
            {value.trim() ? 'Copy as Markdown' : 'Skip and copy'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Props for the action icons. */
interface IconProps {
  /** Sizing classes. */
  className?: string
}

function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"
      />
    </svg>
  )
}

function PrinterIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Z"
      />
    </svg>
  )
}

function TickIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}
