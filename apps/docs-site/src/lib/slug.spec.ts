import { describe, expect, it } from 'vitest'
import { createHeadingSlugger, extractMarkdownSections, generateSlug, stripInlineMarkdown } from './slug'

describe('generateSlug', () => {
  it('lowercases, strips punctuation, and hyphenates spaces', () => {
    expect(generateSlug('What is @hyperfrontend/features?')).toBe('what-is-hyperfrontendfeatures')
  })

  it('collapses runs of hyphens and trims edge hyphens', () => {
    expect(generateSlug('--Weird -- Heading--')).toBe('weird-heading')
  })
})

describe('createHeadingSlugger', () => {
  it('suffixes duplicate headings exactly like the rendered page', () => {
    const slugger = createHeadingSlugger()
    expect([slugger('Usage'), slugger('Usage'), slugger('Usage')]).toEqual(['usage', 'usage-1', 'usage-2'])
  })
})

describe('stripInlineMarkdown', () => {
  it('reduces inline code, links, and emphasis to display text', () => {
    expect(stripInlineMarkdown('Use **`createBroker`** from [nexus](/docs/libraries/nexus)')).toBe('Use createBroker from nexus')
  })

  it('removes html tags whether or not they are terminated', () => {
    expect(stripInlineMarkdown('Teardown <br> and <script src=x')).toBe('Teardown  and')
  })

  it('leaves no tag behind when tags nest', () => {
    expect(stripInlineMarkdown('<<b>script>Setup</script>')).toBe('Setup')
  })

  it('keeps a bare comparison that is not a tag', () => {
    expect(stripInlineMarkdown('Latency < 100ms')).toBe('Latency < 100ms')
  })
})

describe('extractMarkdownSections', () => {
  it('extracts h2 and h3 sections with page-accurate anchors', () => {
    const markdown = ['# Title', '', '## Setup', '', '### Setup', '', '```md', '## Not a heading', '```', '', '## Usage'].join('\n')
    expect(extractMarkdownSections(markdown)).toEqual([
      { title: 'Setup', anchor: 'setup', level: 2 },
      // why: The h1 'Title' consumed the slugger's first slot, and 'Setup' repeats, so the h3 lands on setup-1 exactly as the page renders it
      { title: 'Setup', anchor: 'setup-1', level: 3 },
      { title: 'Usage', anchor: 'usage', level: 2 },
    ])
  })

  it('excludes the document title and fenced pseudo-headings', () => {
    const markdown = ['# Only Title', '', '```bash', '# comment', '```'].join('\n')
    expect(extractMarkdownSections(markdown)).toEqual([])
  })
})
