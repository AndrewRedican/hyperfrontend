/**
 * A single mermaid diagram extracted from markdown source: a placeholder id
 * paired with the chart text that should be rendered in its place.
 */
export type MermaidDiagram = {
  /** Unique identifier for the diagram placeholder */
  id: string
  /** The mermaid chart definition */
  chart: string
}

/**
 * Result of {@link extractMermaidBlocks}: the rewritten markdown plus all the
 * diagrams pulled out of it.
 */
export type ExtractMermaidBlocksResult = {
  /** The markdown content with mermaid blocks replaced by placeholders */
  processedContent: string
  /** Array of extracted mermaid diagrams */
  diagrams: MermaidDiagram[]
}

/**
 * Process markdown content and replace mermaid code blocks with placeholders
 * for client-side rendering.
 *
 * @param content - The markdown content to process
 * @returns The processed content paired with the extracted diagrams
 */
export function extractMermaidBlocks(content: string): ExtractMermaidBlocksResult {
  const diagrams: MermaidDiagram[] = []
  let index = 0

  const processedContent = content.replace(/```mermaid\n([\s\S]*?)```/g, (_, chart) => {
    const id = `mermaid-block-${index++}`
    diagrams.push({ id, chart: chart.trim() })
    return `<div data-mermaid-id="${id}"></div>`
  })

  return { processedContent, diagrams }
}
