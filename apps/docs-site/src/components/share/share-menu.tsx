'use client'

import { trackShare } from '@/lib/analytics-events'
import { buildShareDescriptor, buildShareTargets } from '@/lib/share'
import { useEffect, useRef, useState } from 'react'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

interface ShareMenuProps {
  /** Site-relative route of the page being shared */
  path: string
  /** Page title */
  title: string
  /** One page-specific line for composed share text; defaults to the title */
  pageLine?: string
}

/**
 * Share control for content pages: a button opening a small menu with the
 * device share sheet (where supported), LinkedIn, X, WhatsApp, and copy link.
 *
 * Works without the Web Share API (the native entry simply does not render),
 * closes on Escape and outside interaction, restores focus to the trigger,
 * and keeps every target comfortably tappable.
 * @param props - Component props
 * @param props.path - Site-relative route of the page being shared
 * @param props.title - Page title
 * @param props.pageLine - One page-specific line for composed share text
 * @returns The rendered share control
 */
export function ShareMenu({ path, title, pageLine }: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLElement | null>(null)

  const descriptor = buildShareDescriptor(path, title, pageLine)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && event.target instanceof Node && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    firstItemRef.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const nativeShare = async () => {
    trackShare('native', path)
    try {
      await navigator.share({ title: descriptor.title, text: descriptor.text, url: descriptor.url })
      setOpen(false)
    } catch {
      // why: The user dismissing the OS share sheet is not an error worth surfacing
    }
  }

  const copyLink = async () => {
    trackShare('copy-link', path)
    try {
      await navigator.clipboard.writeText(descriptor.url)
      setCopied(true)
    } catch {
      window.prompt('Copy this link:', descriptor.url)
    }
  }

  const itemClasses =
    'flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-800 dark:focus:bg-slate-800'

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
      >
        <ShareIcon className="h-4 w-4" />
        Share
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Share this page"
          className="absolute right-0 z-[80] mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {canNativeShare ? (
            <button
              ref={(element) => {
                firstItemRef.current = element
              }}
              type="button"
              role="menuitem"
              onClick={nativeShare}
              className={itemClasses}
            >
              <DeviceIcon className="h-4 w-4 text-slate-400" />
              Share via device…
            </button>
          ) : null}
          {buildShareTargets(descriptor).map((target, targetIndex) => (
            <a
              key={target.id}
              ref={
                !canNativeShare && targetIndex === 0
                  ? (element) => {
                      firstItemRef.current = element
                    }
                  : undefined
              }
              role="menuitem"
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackShare(target.id, path)
                setOpen(false)
              }}
              className={itemClasses}
            >
              <span className="w-4 text-center text-xs font-bold text-slate-400">{target.label.charAt(0)}</span>
              {target.label}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={copyLink} className={itemClasses}>
            <LinkIcon className="h-4 w-4 text-slate-400" />
            {copied ? 'Link copied ✓' : 'Copy link'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

type IconProps = { className?: string }

function ShareIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    </svg>
  )
}

function DeviceIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3"
      />
    </svg>
  )
}

function LinkIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
      />
    </svg>
  )
}
