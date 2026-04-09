'use client'

import { useEffect, useRef } from 'react'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { MermaidDiagram } from './mermaid-diagram'

interface ReadmeContentProps {
  html: string
  mermaidDiagrams: { id: string; chart: string }[]
}

/**
 * Injects copy buttons into all `<pre>` code blocks within a container.
 * Handles clipboard copy with visual feedback.
 * @param container
 */
function injectCopyButtons(container: HTMLElement): () => void {
  const preBlocks = container.querySelectorAll('pre')
  const cleanupFns: (() => void)[] = []

  preBlocks.forEach((pre) => {
    if (pre.querySelector('[data-copy-btn]')) return

    const btn = document.createElement('button')
    btn.setAttribute('data-copy-btn', 'true')
    btn.setAttribute('type', 'button')
    btn.setAttribute('aria-label', 'Copy code to clipboard')
    btn.className = [
      'absolute',
      'right-2',
      'top-2',
      'rounded',
      'bg-slate-700',
      'px-2',
      'py-1',
      'text-xs',
      'font-medium',
      'text-slate-300',
      'opacity-0',
      'transition-opacity',
      'hover:bg-slate-600',
      'hover:text-white',
      'focus:opacity-100',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-primary-500',
      'group-hover:opacity-100',
    ].join(' ')
    btn.textContent = 'Copy'

    const handleClick = async () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        btn.textContent = 'Copied!'
        btn.classList.add('bg-green-600')
        btn.classList.remove('bg-slate-700')
        setTimeout(() => {
          btn.textContent = 'Copy'
          btn.classList.remove('bg-green-600')
          btn.classList.add('bg-slate-700')
        }, 2000)
      } catch {
        btn.textContent = 'Failed'
        setTimeout(() => {
          btn.textContent = 'Copy'
        }, 2000)
      }
    }

    btn.addEventListener('click', handleClick)

    pre.style.position = 'relative'
    pre.classList.add('group')
    pre.appendChild(btn)

    cleanupFns.push(() => {
      btn.removeEventListener('click', handleClick)
      btn.remove()
    })
  })

  return () => {
    cleanupFns.forEach((fn) => fn())
  }
}

export function ReadmeContent({ html, mermaidDiagrams }: ReadmeContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const cleanup = injectCopyButtons(container)
    return cleanup
  }, [html])

  return (
    <div className="readme-content" ref={containerRef}>
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
          prose-pre:relative prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-700
          prose-pre:rounded-lg prose-pre:overflow-x-auto
          [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100
          [&_pre_code]:text-sm [&_pre_code]:leading-relaxed
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
