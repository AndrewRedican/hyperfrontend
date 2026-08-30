'use client'

import type { DocumentDescriptor } from '@/lib/document-model'
import { buildHandoffTargets, markdownPathFor } from '@/lib/document-model'
import { useCallback, useEffect, useState } from 'react'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { AssistantIcon, CheckIcon, CopyIcon, RawFileIcon } from './document-icons'

/** How far the copy confirmation stays up before the button reverts. */
const CONFIRMATION_MS = 2000

/** What the copy control is currently saying. */
type CopyState = 'idle' | 'working' | 'copied' | 'failed'

/** Labels the copy control shows in each state. */
const COPY_LABELS: Record<CopyState, string> = {
  idle: 'Copy as Markdown',
  working: 'Copying…',
  copied: 'Copied to clipboard',
  failed: 'Could not copy',
}

/** Props for {@link DocumentActions}. */
export interface DocumentActionsProps {
  /** The document these actions act on */
  descriptor: DocumentDescriptor
}

/**
 * The document-level actions: take this document as Markdown, or hand it to an
 * assistant.
 *
 * All four act on one artefact, the Markdown counterpart published beside the
 * page. Copying fetches that file rather than reassembling the document from
 * the DOM, so what lands on the clipboard is the documentation itself and not
 * the navigation, buttons, and anchor glyphs wrapped around it. The two
 * handoffs pass the same file's URL to an assistant instead of its contents,
 * which keeps the link short enough to survive every browser and app in the
 * path, and means the model reads the current documentation rather than a copy
 * frozen at the moment the button was drawn.
 * @param props - See {@link DocumentActionsProps}.
 * @param props.descriptor - The document these actions act on
 * @returns The action list.
 * @example
 * ```tsx
 * <DocumentActions descriptor={{ route: '/docs/libraries/features', title: 'Features', subject: '@hyperfrontend/features', kind: 'package' }} />
 * ```
 */
export function DocumentActions({ descriptor }: DocumentActionsProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const markdownPath = markdownPathFor(descriptor.route)

  useEffect(() => {
    if (copyState !== 'copied' && copyState !== 'failed') return
    const timer = setTimeout(() => setCopyState('idle'), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [copyState])

  const copy = useCallback(async () => {
    setCopyState('working')
    try {
      const response = await fetch(markdownPath)
      if (!response.ok) throw response
      await navigator.clipboard.writeText(await response.text())
      setCopyState('copied')
    } catch {
      // why: the file is a link away in the row below, so a failed copy needs to say so rather than take over the page
      setCopyState('failed')
    }
  }, [markdownPath])

  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" onClick={copy} disabled={copyState === 'working'} className={ACTION_CLASSES}>
        {copyState === 'copied' ? <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" /> : <CopyIcon className="h-4 w-4" />}
        {COPY_LABELS[copyState]}
      </button>

      <a href={markdownPath} target="_blank" rel="noopener noreferrer" className={ACTION_CLASSES}>
        <RawFileIcon className="h-4 w-4" />
        View as Markdown
      </a>

      {buildHandoffTargets(descriptor).map((target) => (
        <a key={target.id} href={target.href} target="_blank" rel="noopener noreferrer" className={ACTION_CLASSES}>
          <AssistantIcon id={target.id} className="h-4 w-4" />
          {target.label}
        </a>
      ))}
    </div>
  )
}

/**
 * Shared chrome for every action: a quiet text row that only picks up a
 * background on hover, so the group reads as a list of verbs rather than as a
 * panel of buttons.
 */
const ACTION_CLASSES =
  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-default disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
