import { describe, expect, it } from 'vitest'
import { dropSections, enhanceSection, findSections, readSection, readSectionLink, splitTitle } from './readme-sections'

/** A README shaped like the ones this site publishes, with every case the page has to handle. */
const README = [
  '# @hyperfrontend/example',
  '',
  'One line about the package.',
  '',
  '## Quick Start',
  '',
  '```bash',
  '# not a heading',
  'npm install @hyperfrontend/example',
  '```',
  '',
  '## Compatibility',
  '',
  '| Platform | Support |',
  '| -------- | :-----: |',
  '| Browser  |   ✅    |',
  '',
  '### Output Formats',
  '',
  '| Format | File           |',
  '| ------ | -------------- |',
  '| ESM    | `index.esm.js` |',
  '',
  '### CDN Usage',
  '',
  '```html',
  '<script src="https://unpkg.com/@hyperfrontend/example"></script>',
  '```',
  '',
  '## Part of hyperfrontend',
  '',
  'This library is part of the monorepo.',
  '',
  '## License',
  '',
  '[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)',
  '',
].join('\n')

describe('findSections', () => {
  it('gives a section the lines of its own subsections', () => {
    const [compatibility] = findSections(README).filter((section) => section.slug === 'compatibility')
    const lines = README.split('\n').slice(compatibility.headingLine, compatibility.endLine)
    expect(lines).toContain('### CDN Usage')
    expect(lines).not.toContain('## Part of hyperfrontend')
  })

  it('ignores a hash inside a fenced code block', () => {
    expect(findSections(README).map((section) => section.title)).not.toContain('not a heading')
  })
})

describe('splitTitle', () => {
  it('lifts the leading heading out of the body', () => {
    const { title, body } = splitTitle(README)
    expect(title).toBe('@hyperfrontend/example')
    expect(body.startsWith('One line about the package.')).toBe(true)
  })

  it('leaves a document with no leading heading untouched', () => {
    expect(splitTitle('Just prose.\n')).toEqual({ title: null, body: 'Just prose.\n' })
  })
})

describe('readSection', () => {
  it('returns a section body without its heading', () => {
    expect(readSection(README, 'part-of-hyperfrontend')).toBe('This library is part of the monorepo.')
  })

  it('returns null for a section the document does not have', () => {
    expect(readSection(README, 'security')).toBeNull()
  })
})

describe('readSectionLink', () => {
  it('returns the destination the licence section points at', () => {
    expect(readSectionLink(README, 'license')).toBe('https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md')
  })
})

describe('dropSections', () => {
  it('removes a section and keeps everything around it', () => {
    const result = dropSections(README, ['license', 'part-of-hyperfrontend'])
    expect(result).not.toContain('## License')
    expect(result).not.toContain('## Part of hyperfrontend')
    expect(result).toContain('## Compatibility')
  })
})

describe('enhanceSection', () => {
  it('replaces the section lead with the placeholder and keeps the heading', () => {
    const result = enhanceSection(README, 'compatibility', '<div data-readme-slot="capabilities"></div>', ['output-formats'])
    expect(result).toContain('## Compatibility\n\n<div data-readme-slot="capabilities"></div>')
    expect(result).not.toContain('### Output Formats')
  })

  it('leaves a subsection it was not asked to drop, with a blank line before its heading', () => {
    const result = enhanceSection(README, 'compatibility', '<div data-readme-slot="capabilities"></div>', ['output-formats'])
    expect(result).toContain('<div data-readme-slot="capabilities"></div>\n\n### CDN Usage')
  })

  it("keeps a kept subsection's fenced block intact when a dropped subsection precedes it", () => {
    const result = enhanceSection(README, 'compatibility', '<div data-readme-slot="capabilities"></div>', ['output-formats'])
    expect(result).toContain('```html\n<script src="https://unpkg.com/@hyperfrontend/example"></script>\n```')
  })

  it('returns the document unchanged when the section is absent', () => {
    const markdown = '## Usage\n\nText.\n'
    expect(enhanceSection(markdown, 'compatibility', '<div></div>')).toBe(markdown)
  })
})
