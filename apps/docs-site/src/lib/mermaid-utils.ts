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
 * Strips the indentation a fenced block carried in its source.
 *
 * A fence nested in a list item is indented to stay inside that item, and the
 * indentation belongs to the markdown rather than to the chart. Removing it
 * from the outer edges alone leaves the first line flush and every later one
 * inset, which is precisely the shape mermaid rejects: its front-matter reader
 * matches the closing `---` against the indentation it saw on the opening one,
 * so a chart whose opening fence was trimmed and whose closing fence was not
 * has no front matter it can find, and the `---` reaches the diagram parser as
 * a diagram type it does not know.
 *
 * Up to the opening fence's own indentation is removed from each line, which is
 * what CommonMark says a fenced block's content means, and lines indented
 * further keep the difference.
 *
 * @param chart - The raw text captured between the fences
 * @param indent - The whitespace the opening fence was indented by
 * @returns The chart with the fence's indentation removed from every line
 */
function stripFenceIndent(chart: string, indent: string): string {
  if (indent === '') {
    return chart.trim()
  }
  return chart
    .split('\n')
    .map((line) => {
      let removed = 0
      while (removed < indent.length && (line[removed] === ' ' || line[removed] === '\t')) {
        removed += 1
      }
      return line.slice(removed)
    })
    .join('\n')
    .trim()
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

  const processedContent = content.replace(/^([ \t]*)```mermaid[ \t]*\n([\s\S]*?)^[ \t]*```/gm, (_, indent: string, chart: string) => {
    const id = `mermaid-block-${index++}`
    diagrams.push({ id, chart: stripFenceIndent(chart, indent) })
    // note: The placeholder keeps the fence's indentation so a diagram nested in a list item stays inside it.
    return `${indent}<div data-mermaid-id="${id}"></div>`
  })

  return { processedContent, diagrams }
}
