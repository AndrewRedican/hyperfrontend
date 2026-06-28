'use client'

import { useState } from 'react'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** Props for {@link CopyButton}. */
interface CopyButtonProps {
  /** The raw code copied to the clipboard when clicked. */
  code: string
}

/**
 * A copy-to-clipboard button overlaid on a code block. Kept as a small client
 * island so the surrounding {@link CodeBlock} can stay a server component and
 * highlight code at render time.
 * @param root0 - The props object.
 * @param root0.code - The raw code copied to the clipboard when clicked.
 * @returns A button that copies `code` and shows transient confirmation.
 */
export function CopyButton({ code }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      // Silently fail if clipboard API unavailable
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy code to clipboard"
      className={`absolute right-2 top-2 rounded px-2 py-1 text-xs font-medium transition-all
        opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary-500
        ${copied ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}`}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
