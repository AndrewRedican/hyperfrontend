'use client'

import { useState, useEffect } from 'react'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { logger } from '@hyperfrontend/logging'

interface ExampleBlockProps {
  code: string
  /** Optional label for the example */
  label?: string
}

/**
 * A syntax-highlighted example snippet with copy-to-clipboard support.
 *
 * Highlighting uses the same dual-theme Shiki setup as the rest of the site
 * (github-light / github-dark selected by the `.dark` class). The highlighter
 * is loaded lazily on the client; until it resolves, the raw code renders in a
 * plain block with matching dimensions so there is no layout shift.
 * @param props - Component props.
 * @param props.code - The example source, optionally wrapped in a fenced code block.
 * @param props.label - Optional label displayed above the snippet.
 */
export function ExampleBlock({ code, label }: ExampleBlockProps) {
  const [copied, setCopied] = useState(false)
  const [highlightedHtml, setHighlightedHtml] = useState('')

  const trimmed = code.trim()
  const language = /^```(\w+)/.exec(trimmed)?.[1] ?? 'typescript'
  const cleanCode = trimmed
    .replace(/^```\w*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  useEffect(() => {
    let cancelled = false
    import('@/lib/shiki')
      .then(({ highlightCode }) => highlightCode(cleanCode, language))
      .then((html) => {
        if (!cancelled) setHighlightedHtml(html)
      })
      .catch(() => {
        logger.warn('Syntax highlighting failed; showing plain code')
      })
    return () => {
      cancelled = true
    }
  }, [cleanCode, language])

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanCode)
      setCopied(true)
    } catch {
      logger.warn('Copy to clipboard failed')
    }
  }

  return (
    <div className="mt-3 relative group">
      {label && <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>}
      <div className="relative">
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
            aria-label="Copy code"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {highlightedHtml ? (
          <div
            className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-x-auto text-sm leading-relaxed">
            <code>{cleanCode}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
