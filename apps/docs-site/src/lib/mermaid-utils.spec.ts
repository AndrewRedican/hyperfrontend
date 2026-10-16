import { describe, expect, it } from 'vitest'
import { extractMermaidBlocks } from './mermaid-utils'

/**
 * Mermaid's own front-matter reader, copied from `mermaid@11` so the tests
 * assert against the behaviour the renderer actually has rather than a
 * paraphrase of it.
 *
 * The backreference is the whole point: whatever indentation the opening `---`
 * carried, the closing one has to carry the same. A chart whose fences
 * disagree has no front matter mermaid can find, and the `---` then reaches
 * the diagram parser as a diagram type it does not know.
 */
const FRONT_MATTER = /^([^\S\n\r]*)-{3}\s*[\n\r](.*?)[\n\r]\1-{3}\s*[\n\r]+/s

/** Two charts with prose between them, as a page carrying more than one diagram has. */
const TWO_CHARTS = [
  '# Title',
  '',
  '```mermaid',
  'flowchart TD',
  '  A --> B',
  '```',
  '',
  'Between.',
  '',
  '```mermaid',
  'graph LR',
  '  C --> D',
  '```',
  '',
].join('\n')

/** A chart with front matter, fenced inside a numbered list item. */
const NESTED_CHART = [
  '1. A step with a diagram:',
  '',
  '   ```mermaid',
  '   ---',
  '   config:',
  '     theme: base',
  '   ---',
  '   sequenceDiagram',
  '       A->>B: hello',
  '   ```',
  '',
  '2. The next step.',
].join('\n')

describe('extractMermaidBlocks', () => {
  it('replaces each fenced block with a placeholder', () => {
    expect(extractMermaidBlocks(TWO_CHARTS).processedContent).toBe(
      [
        '# Title',
        '',
        '<div data-mermaid-id="mermaid-block-0"></div>',
        '',
        'Between.',
        '',
        '<div data-mermaid-id="mermaid-block-1"></div>',
        '',
      ].join('\n')
    )
  })

  it('returns the charts in order', () => {
    expect(extractMermaidBlocks(TWO_CHARTS).diagrams).toEqual([
      { id: 'mermaid-block-0', chart: 'flowchart TD\n  A --> B' },
      { id: 'mermaid-block-1', chart: 'graph LR\n  C --> D' },
    ])
  })

  it('leaves an unindented chart exactly as authored', () => {
    const chart = ['---', 'config:', '  theme: base', '---', 'sequenceDiagram', '    A->>B: hello'].join('\n')
    const { diagrams } = extractMermaidBlocks(`\`\`\`mermaid\n${chart}\n\`\`\``)

    expect(diagrams[0]?.chart).toBe(chart)
  })

  it('leaves the front matter of an unindented chart where mermaid looks for it', () => {
    const chart = ['---', 'config:', '  theme: base', '---', 'sequenceDiagram', '    A->>B: hello'].join('\n')
    const { diagrams } = extractMermaidBlocks(`\`\`\`mermaid\n${chart}\n\`\`\``)

    expect(FRONT_MATTER.test(diagrams[0]?.chart ?? '')).toBe(true)
  })

  it('strips the fence indentation from a chart nested in a list item', () => {
    // why: the defect this guards against trimmed only the outer edges, which left the opening
    // why: `---` flush and the closing one indented, and mermaid rejected the whole diagram
    const { diagrams } = extractMermaidBlocks(NESTED_CHART)

    expect(diagrams[0]?.chart).toBe(['---', 'config:', '  theme: base', '---', 'sequenceDiagram', '    A->>B: hello'].join('\n'))
  })

  it('leaves the front matter of a chart nested in a list item where mermaid looks for it', () => {
    const { diagrams } = extractMermaidBlocks(NESTED_CHART)

    expect(FRONT_MATTER.test(diagrams[0]?.chart ?? '')).toBe(true)
  })

  it('indents the placeholder so the chart stays inside its list item', () => {
    const { processedContent } = extractMermaidBlocks(NESTED_CHART)

    // why: the placeholder keeps the indentation so the block stays inside its list item
    expect(processedContent).toBe(
      ['1. A step with a diagram:', '', '   <div data-mermaid-id="mermaid-block-0"></div>', '', '2. The next step.'].join('\n')
    )
  })

  it('keeps indentation the chart itself uses beyond the fence', () => {
    const markdown = ['  ```mermaid', '  flowchart TD', '      A --> B', '  ```'].join('\n')

    expect(extractMermaidBlocks(markdown).diagrams[0]?.chart).toBe('flowchart TD\n    A --> B')
  })

  it('returns the content untouched when there is no diagram', () => {
    const markdown = '# Title\n\n```ts\nconst a = 1\n```\n'

    expect(extractMermaidBlocks(markdown)).toEqual({ processedContent: markdown, diagrams: [] })
  })
})
