'use client'

import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'
import { random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { logger } from '@hyperfrontend/logging'

// Initialize mermaid with theme configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontSize: '14px',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    primaryColor: '#3b82f6',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#2563eb',
    lineColor: '#64748b',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#e2e8f0',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    diagramMarginX: 10,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
})

interface MermaidDiagramProps {
  chart: string
  className?: string
}

export function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return

      try {
        // Generate unique ID for each diagram
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
  }, [chart])

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
    <div
      ref={containerRef}
      className={`mermaid-diagram overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
