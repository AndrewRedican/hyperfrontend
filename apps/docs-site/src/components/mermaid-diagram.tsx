'use client'

import mermaid from 'mermaid'
import { useCallback, useEffect, useRef, useState } from 'react'
import { random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { logger } from '@hyperfrontend/logging'
import { createMermaidConfig } from '../lib/mermaid-theme'
import { DiagramModal } from './diagram-modal'
import { useTheme } from './theme-provider'

interface MermaidDiagramProps {
  /** The Mermaid chart definition string */
  chart: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Renders a Mermaid diagram with theme-aware styling and click-to-expand functionality.
 *
 * Features:
 * - Automatically adapts to light/dark theme
 * - Centers diagrams that don't fill the container
 * - Click to expand large diagrams in a full-screen modal
 * - Error state with syntax preview for debugging
 * @param props - The component props
 * @param props.chart - The Mermaid chart definition string
 * @param props.className - Additional CSS classes
 * @returns The rendered diagram JSX
 */
export function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const { resolvedTheme } = useTheme()

  // why: Re-render diagram when theme changes to apply correct colors
  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return

      try {
        // why: Configure mermaid for current theme before rendering
        const config = createMermaidConfig(resolvedTheme)
        mermaid.initialize(config)

        const id = `mermaid-${random().toString(36).substring(2, 9)}`
        const { svg } = await mermaid.render(id, chart)
        setSvg(svg)
        setError(null)
      } catch (err) {
        logger.error('Mermaid rendering error:', err)
        setError('Failed to render diagram')
      }
    }

    renderDiagram()
  }, [chart, resolvedTheme])

  const handleExpand = useCallback(() => {
    setIsExpanded(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsExpanded(false)
  }, [])

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30 ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <pre className="mt-2 overflow-x-auto text-xs text-red-500">
          <code>{chart}</code>
        </pre>
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        onClick={handleExpand}
        className={`mermaid-diagram group relative mx-auto flex cursor-zoom-in
          items-center justify-center overflow-x-auto rounded-lg border
          border-slate-200 bg-white p-4 transition-shadow
          hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${className}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleExpand()
          }
        }}
        aria-label="Click to expand diagram"
        title="Click to expand"
      >
        {/* Expand indicator overlay */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center
            rounded-lg bg-black/0 opacity-0 transition-all group-hover:bg-black/5
            group-hover:opacity-100 dark:group-hover:bg-white/5"
        >
          <div
            className="rounded-full bg-white/90 p-2 shadow-lg
              dark:bg-slate-800/90"
          >
            <ExpandIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
        </div>

        {/* SVG content */}
        <div className="[&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      {/* Expanded modal */}
      <DiagramModal svg={svg} isOpen={isExpanded} onClose={handleClose} />
    </>
  )
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
      />
    </svg>
  )
}
