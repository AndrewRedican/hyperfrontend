'use client'

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@hyperfrontend/logging'

interface CopyButtonProps {
  text: string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * A reusable copy-to-clipboard button component
 * @param props - Component props
 * @param props.text - The text to copy to clipboard
 * @param props.className - Additional CSS classes
 * @param props.size - Button size variant
 */
export function CopyButton({ text, className = '', size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
      } catch {
        logger.warn('Copy to clipboard failed')
      }
      document.body.removeChild(textArea)
    }
  }, [text])

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'

  return (
    <button
      onClick={handleCopy}
      className={`
        ${sizeClasses}
        rounded
        transition-all
        duration-200
        ${
          copied
            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
        }
        ${className}
      `}
      aria-label="Copy to clipboard"
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <span className="flex items-center gap-1">
          <CheckIcon className="w-3 h-3" />
          Copied
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <CopyIcon className="w-3 h-3" />
          Copy
        </span>
      )}
    </button>
  )
}

function CopyIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 1.927-.184"
      />
    </svg>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}
