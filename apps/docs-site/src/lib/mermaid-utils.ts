/**
 * Process markdown content and replace mermaid code blocks with placeholders
 * for client-side rendering
 *
 * @param content - The markdown content to process
 * @returns An object containing the processed content and extracted diagrams
 */
export function extractMermaidBlocks(content: string): {
  /** The markdown content with mermaid blocks replaced by placeholders */
  processedContent: string
  /** Array of extracted mermaid diagrams */
  diagrams: {
    /** Unique identifier for the diagram placeholder */
    id: string
    /** The mermaid chart definition */
    chart: string
  }[]
} {
  const diagrams: {
    /** Unique identifier for the diagram placeholder */
    id: string
    /** The mermaid chart definition */
    chart: string
  }[] = []
  let index = 0

  const processedContent = content.replace(/```mermaid\n([\s\S]*?)```/g, (_, chart) => {
    const id = `mermaid-block-${index++}`
    diagrams.push({ id, chart: chart.trim() })
    return `<div data-mermaid-id="${id}"></div>`
  })

  return { processedContent, diagrams }
}
