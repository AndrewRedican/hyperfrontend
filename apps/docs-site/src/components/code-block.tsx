'use client'

import { useState } from 'react'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

interface CodeBlockProps {
  /** The code content to display */
  code: string
  /** Optional language label to show in header (e.g., "bash", "typescript") */
  language?: string
  /** Additional class name for top margin adjustment */
  className?: string
}

/**
 * A code block component with copy-to-clipboard functionality.
 * Supports optional language header display.
 * @param root0 The props object containing code, language, and className.
 * @param root0.code The code string to display inside the block.
 * @param root0.language An optional string to indicate the programming language, shown in the header.
 * @param root0.className An optional string for additional CSS classes, primarily for margin adjustments.
 * @returns A JSX element representing the styled code block with a copy button.
 */
export function CodeBlock({ code, language, className = 'mt-4' }: CodeBlockProps) {
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
    <div className={`group overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700 ${className}`}>
      {language && (
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
          <span className="text-xs text-slate-400">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto p-4">
          <code className="text-sm text-slate-100">{code}</code>
        </pre>
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
      </div>
    </div>
  )
}
