'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface DiagramModalProps {
  /** SVG content to display */
  svg: string
  /** Called when modal should close */
  onClose: () => void
  /** Whether the modal is open */
  isOpen: boolean
}

/**
 * Modifies SVG to scale proportionally by removing fixed dimensions and ensuring viewBox exists.
 * @param svg - The original SVG string from mermaid
 * @returns Modified SVG that scales to fill its container
 */
function makeScalableSvg(svg: string): string {
  // why: Mermaid bakes fixed width/height into root SVG; we need to modify only the root element
  // note: Must be careful not to remove width/height from internal elements like <rect>

  // why: Match and extract the opening <svg ...> tag only
  const svgTagMatch = /^(<svg[^>]*>)/i.exec(svg)
  if (!svgTagMatch) return svg

  const originalSvgTag = svgTagMatch[1]
  let modifiedSvgTag = originalSvgTag

  // why: Extract viewBox or create one from width/height before removing them
  const widthMatch = /\swidth="([^"]+)"/.exec(originalSvgTag)
  const heightMatch = /\sheight="([^"]+)"/.exec(originalSvgTag)
  const hasViewBox = /viewBox=/.test(originalSvgTag)

  if (!hasViewBox && widthMatch && heightMatch) {
    // why: Create viewBox from original dimensions to preserve aspect ratio
    const width = widthMatch[1].replace(/[^\d.]/g, '')
    const height = heightMatch[1].replace(/[^\d.]/g, '')
    modifiedSvgTag = modifiedSvgTag.replace(/<svg/, `<svg viewBox="0 0 ${width} ${height}"`)
  }

  // why: Remove fixed dimensions from root SVG only so it can scale via CSS
  modifiedSvgTag = modifiedSvgTag.replace(/\swidth="[^"]*"/, '')
  modifiedSvgTag = modifiedSvgTag.replace(/\sheight="[^"]*"/, '')

  // why: Add width/height 100% to fill container while viewBox maintains aspect ratio
  modifiedSvgTag = modifiedSvgTag.replace(/<svg/, '<svg width="100%" height="100%"')

  // why: Replace only the root SVG tag, leaving all internal elements unchanged
  return svg.replace(originalSvgTag, modifiedSvgTag)
}

/**
 * Full-screen modal for viewing diagrams at a larger scale.
 * Uses portal to escape parent stacking contexts.
 * Implements keyboard navigation (Escape to close) and click-outside-to-close.
 * @param props - The component props
 * @param props.svg - SVG content to display
 * @param props.onClose - Called when modal should close
 * @param props.isOpen - Whether the modal is open
 * @returns The modal JSX or null if not mounted/open
 */
export function DiagramModal({ svg, onClose, isOpen }: DiagramModalProps) {
  const [mounted, setMounted] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  // why: Pre-process SVG to remove fixed dimensions for proper scaling
  const scaledSvg = useMemo(() => makeScalableSvg(svg), [svg])

  useEffect(() => {
    setMounted(true)
  }, [])

  // why: Lock body scroll when open to prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // why: Handle Escape key for accessibility
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // why: Handle click outside content for intuitive dismissal
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded diagram view"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition-colors hover:bg-white hover:text-slate-900 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label="Close expanded view"
      >
        <CloseIcon className="h-6 w-6" />
      </button>

      {/* Hint text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-sm text-white/80">
        Press <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">Esc</kbd> or click outside to close
      </div>

      {/* Diagram content container */}
      <div
        className="flex h-[80vh] w-[85vw] items-center justify-center overflow-auto rounded-lg bg-white p-8 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mermaid-diagram-expanded flex h-full w-full items-center justify-center"
          dangerouslySetInnerHTML={{ __html: scaledSvg }}
        />
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
