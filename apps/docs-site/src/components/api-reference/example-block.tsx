'use client'

import { useState, useEffect } from 'react'

interface ExampleBlockProps {
  code: string
}

// Renders an `@example` code block with syntax highlighting
export function ExampleBlock({ code }: ExampleBlockProps) {
  const [copied, setCopied] = useState(false)

  // Clean up the code - remove leading/trailing whitespace and common indentation
  const cleanCode = code
    .trim()
    .replace(/^```\w*\n?/, '') // Remove opening code fence
    .replace(/\n?```$/, '') // Remove closing code fence
    .trim()

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
      // Fallback for browsers that don't support clipboard API
      console.warn('Copy to clipboard failed')
    }
  }

  return (
    <div className="mt-3 relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
          aria-label="Copy code"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-sm">
        <code>{cleanCode}</code>
      </pre>
    </div>
  )
}
