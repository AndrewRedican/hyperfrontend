'use client'

import { MermaidDiagram } from './mermaid-diagram'

interface ReadmeContentProps {
  html: string
  mermaidDiagrams: { id: string; chart: string }[]
}

export function ReadmeContent({ html, mermaidDiagrams }: ReadmeContentProps) {
  return (
    <div className="readme-content">
      {/* Main HTML content */}
      <div
        className="prose prose-slate max-w-none dark:prose-invert
          prose-headings:scroll-mt-20 prose-headings:font-display
          prose-h1:text-4xl prose-h1:font-bold prose-h1:tracking-tight
          prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-p:leading-7
          prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline
          prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5
          prose-code:font-normal prose-code:text-slate-700 prose-code:before:content-none prose-code:after:content-none
          dark:prose-code:bg-slate-800 dark:prose-code:text-slate-300
          prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-700
          prose-pre:rounded-lg prose-pre:overflow-x-auto
          prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-700
          prose-th:bg-slate-50 dark:prose-th:bg-slate-800 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold
          prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-slate-200 dark:prose-td:border-slate-700
          prose-ul:my-4 prose-li:my-1
          prose-strong:text-slate-900 dark:prose-strong:text-white"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Render Mermaid diagrams */}
      {mermaidDiagrams.length > 0 && (
        <div className="mt-8 space-y-6">
          {mermaidDiagrams.map(({ id, chart }) => (
            <div key={id}>
              <MermaidDiagram chart={chart} className="my-6" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
