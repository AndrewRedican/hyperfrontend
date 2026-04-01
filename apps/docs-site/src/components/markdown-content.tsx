'use client'

import { useEffect, useState } from 'react'
import { MermaidDiagram } from './mermaid-diagram'

interface MarkdownContentProps {
  html: string
  mermaidDiagrams?: { id: string; chart: string }[]
  className?: string
}

export function MarkdownContent({ html, mermaidDiagrams = [], className = '' }: MarkdownContentProps) {
  const [processedHtml, setProcessedHtml] = useState(html)

  useEffect(() => {
    setProcessedHtml(html)
  }, [html])

  return (
    <div className={`markdown-content ${className}`}>
      {/* Render main HTML content */}
      <div
        className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-display prose-h2:text-2xl prose-h3:text-xl prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-slate-800 prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-700"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      {/* Render Mermaid diagrams */}
      {mermaidDiagrams.length > 0 && <MermaidRenderer diagrams={mermaidDiagrams} />}
    </div>
  )
}

interface MermaidRendererProps {
  diagrams: { id: string; chart: string }[]
}

function MermaidRenderer({ diagrams }: MermaidRendererProps) {
  useEffect(() => {
    diagrams.forEach(({ id }) => {
      const placeholder = document.querySelector(`[data-mermaid-id="${id}"]`)
      if (placeholder) {
        placeholder.setAttribute('data-processed', 'true')
      }
    })
  }, [diagrams])

  return (
    <>
      {diagrams.map(({ id, chart }) => (
        <div key={id} className="my-6">
          <MermaidDiagram chart={chart} />
        </div>
      ))}
    </>
  )
}
