'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { useHashNavigation } from '../hooks/use-hash-navigation'
import { generateSlug } from '../lib/markdown'
import { MermaidDiagram } from './mermaid-diagram'

/**
 * Inline mermaid diagram payload referenced from rendered README markdown:
 * a stable id used to swap a placeholder, paired with the raw chart text.
 */
interface MermaidDiagramEntry {
  id: string
  chart: string
}

interface ReadmeContentProps {
  html: string
  mermaidDiagrams: MermaidDiagramEntry[]
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

/**
 * Injects anchor IDs and clickable anchor links into all headings within a container.
 * Clicking the anchor copies the link and updates the URL hash.
 * @param container - The container element with rendered HTML content
 */
function injectHeadingAnchors(container: HTMLElement): () => void {
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const cleanupFns: (() => void)[] = []
  const usedIds = createSet<string>()

  headings.forEach((heading) => {
    if (heading.querySelector('[data-anchor-link]')) return

    const text = heading.textContent ?? ''
    let id = generateSlug(text)

    if (usedIds.has(id)) {
      let suffix = 1
      while (usedIds.has(`${id}-${suffix}`)) {
        suffix++
      }
      id = `${id}-${suffix}`
    }
    usedIds.add(id)

    heading.id = id

    heading.classList.add('group', 'flex', 'items-center', 'gap-2')

    const anchor = document.createElement('a')
    anchor.setAttribute('data-anchor-link', 'true')
    anchor.setAttribute('href', `#${id}`)
    anchor.setAttribute('aria-label', 'Copy link to this section')
    anchor.setAttribute('title', 'Copy link to this section')
    anchor.className = [
      'opacity-0',
      'group-hover:opacity-100',
      'transition-opacity',
      'duration-200',
      'text-slate-400',
      'hover:text-primary-600',
      'dark:text-slate-500',
      'dark:hover:text-primary-400',
      'shrink-0',
      'no-underline',
      'font-mono',
      'text-sm',
    ].join(' ')
    anchor.textContent = '§'

    let copiedTimer: ReturnType<typeof setTimeout> | null = null

    const handleClick = async (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const url = `${window.location.origin}${window.location.pathname}#${id}`
      window.history.pushState(null, '', `#${id}`)

      try {
        await navigator.clipboard.writeText(url)
        anchor.textContent = '✓'
        anchor.setAttribute('title', 'Link copied!')
        if (copiedTimer) clearTimeout(copiedTimer)
        copiedTimer = setTimeout(() => {
          anchor.textContent = '§'
          anchor.setAttribute('title', 'Copy link to this section')
        }, 2000)
      } catch {
        const textArea = document.createElement('textarea')
        textArea.value = url
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          anchor.textContent = '✓'
          anchor.setAttribute('title', 'Link copied!')
          if (copiedTimer) clearTimeout(copiedTimer)
          copiedTimer = setTimeout(() => {
            anchor.textContent = '§'
            anchor.setAttribute('title', 'Copy link to this section')
          }, 2000)
        } catch {
          // Silent fail
        }
        document.body.removeChild(textArea)
      }
    }

    anchor.addEventListener('click', handleClick)
    heading.appendChild(anchor)

    cleanupFns.push(() => {
      anchor.removeEventListener('click', handleClick)
      if (copiedTimer) clearTimeout(copiedTimer)
      anchor.remove()
      heading.removeAttribute('id')
      heading.classList.remove('group', 'flex', 'items-center', 'gap-2')
    })
  })

  return () => {
    cleanupFns.forEach((fn) => fn())
  }
}

/** Raw HTML chunk in the README split sequence */
interface ReadmeHtmlPart {
  type: 'html'
  content: string
}

/** Mermaid placeholder reference in the README split sequence */
interface ReadmeMermaidPart {
  type: 'mermaid'
  id: string
}

/**
 * Discriminated chunk emitted while splitting README HTML around mermaid
 * placeholders so each chunk can be rendered inline in document order.
 */
type ReadmePart = ReadmeHtmlPart | ReadmeMermaidPart

export function ReadmeContent({ html, mermaidDiagrams }: ReadmeContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // why: Build diagram lookup map for efficient access during rendering
  const diagramMap = useMemo(() => createMap(mermaidDiagrams.map((d) => [d.id, d.chart])), [mermaidDiagrams])

  // why: Split HTML on mermaid placeholders to enable inline rendering
  const parts = useMemo(() => {
    // note: Regex captures the ID from: <div data-mermaid-id="mermaid-block-0"></div>
    const placeholderPattern = /<div data-mermaid-id="([^"]+)"><\/div>/g
    const result: ReadmePart[] = []

    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = placeholderPattern.exec(html)) !== null) {
      // why: Add HTML before placeholder
      if (match.index > lastIndex) {
        result.push({ type: 'html', content: html.slice(lastIndex, match.index) })
      }
      // why: Add mermaid placeholder reference
      result.push({ type: 'mermaid', id: match[1] })
      lastIndex = match.index + match[0].length
    }

    // why: Add remaining HTML after last placeholder
    if (lastIndex < html.length) {
      result.push({ type: 'html', content: html.slice(lastIndex) })
    }

    return result
  }, [html])

  // why: Disable auto-scroll on mount since IDs are injected dynamically; we call scrollToHash manually after injection
  const { scrollToHash } = useHashNavigation({ enabled: false })

  // why: Apply effects to all prose containers for copy buttons and anchors
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // why: Find all prose containers within the readme content
    const proseContainers = container.querySelectorAll('.prose')
    const cleanupFunctions: (() => void)[] = []

    proseContainers.forEach((proseContainer) => {
      cleanupFunctions.push(injectCopyButtons(proseContainer as HTMLElement))
      cleanupFunctions.push(injectHeadingAnchors(proseContainer as HTMLElement))
    })

    // why: Scroll after IDs are injected; hook handles delay internally
    scrollToHash()

    // why: Listen for hash changes while component is mounted
    const handleHashChange = () => scrollToHash()
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      cleanupFunctions.forEach((fn) => fn())
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [html, scrollToHash])

  const proseClasses = `prose prose-slate max-w-none dark:prose-invert
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
    prose-strong:text-slate-900 dark:prose-strong:text-white`

  return (
    <div className="readme-content" ref={containerRef}>
      {parts.map((part, index) => {
        if (part.type === 'html') {
          return <div key={`html-${index}`} className={proseClasses} dangerouslySetInnerHTML={{ __html: part.content }} />
        }

        // why: Render mermaid diagram inline at its original position
        const chart = diagramMap.get(part.id)
        return chart ? <MermaidDiagram key={part.id} chart={chart} className="my-6" /> : null
      })}
    </div>
  )
}
