/**
 * Mermaid processing utilities for server-side use
 * These functions can be safely called from server components
 */

/**
 * Process markdown content and replace mermaid code blocks with placeholders
 * for client-side rendering
 *
 * @param content - The markdown content to process
 * @returns An object containing the processed content and extracted diagrams
 */
export function extractMermaidBlocks(content: string): {
  processedContent: string
  diagrams: { id: string; chart: string }[]
} {
  const diagrams: { id: string; chart: string }[] = []
  let index = 0

  const processedContent = content.replace(/```mermaid\n([\s\S]*?)```/g, (_, chart) => {
    const id = `mermaid-block-${index++}`
    diagrams.push({ id, chart: chart.trim() })
    return `<div data-mermaid-id="${id}"></div>`
  })

  return { processedContent, diagrams }
}
