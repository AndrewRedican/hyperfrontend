'use client'

import { useState, useEffect, useCallback } from 'react'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

interface AnchorLinkProps {
  /**
   * The anchor ID to link to (without the # prefix)
   */
  id: string
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * A clickable anchor link icon (§), always visible at reduced opacity and
 * fully opaque on hover so readers can tell the entry is bookmarkable.
 * Clicking copies the anchor URL to clipboard and updates the URL hash.
 * @param root0
 * @param root0.id
 * @param root0.className
 * @example
 * ```tsx
 * <h2 id="installation" className="group flex items-center gap-2">
 *   Installation
 *   <AnchorLink id="installation" />
 * </h2>
 * ```
 */
export function AnchorLink({ id, className = '' }: AnchorLinkProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const url = `${window.location.origin}${window.location.pathname}#${id}`

      window.history.pushState(null, '', `#${id}`)

      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
      } catch {
        const textArea = document.createElement('textarea')
        textArea.value = url
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          setCopied(true)
        } catch {
          // Silent fail
        }
        document.body.removeChild(textArea)
      }
    },
    [id]
  )

  return (
    <a
      href={`#${id}`}
      onClick={handleClick}
      aria-label={copied ? 'Link copied!' : 'Copy link to this section'}
      title={copied ? 'Link copied!' : 'Copy link to this section'}
      className={`
        opacity-80 hover:opacity-100 group-hover:opacity-100
        transition-opacity duration-200
        text-slate-400 hover:text-primary-600
        dark:text-slate-500 dark:hover:text-primary-400
        shrink-0
        no-underline
        ${className}
      `}
    >
      <span className="font-mono text-sm">{copied ? '✓' : '§'}</span>
    </a>
  )
}
