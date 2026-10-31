import { describe, expect, it } from '@hyperfrontend/testing'
import { generateThirdPartyLicensesContent } from './generate-content'

describe('generateThirdPartyLicensesContent', () => {
  it('emits the heading and table header even when there are no entries', () => {
    expect(generateThirdPartyLicensesContent([])).toContain('# Third-Party Licenses\n\n| Dependency       | Link')
  })

  it('ends the body with a trailing newline even when there are no entries', () => {
    expect(generateThirdPartyLicensesContent([]).endsWith('\n')).toBe(true)
  })

  it('renders entries with a markdown link when a license URL is known', () => {
    const md = generateThirdPartyLicensesContent([{ name: 'foo', licenseType: 'MIT', licenseUrl: 'https://example.com/L' }])
    expect(md).toContain('| `foo`     | [MIT](https://example.com/L) |')
  })

  it('renders entries with a plain license type when the URL is null', () => {
    const md = generateThirdPartyLicensesContent([{ name: 'foo', licenseType: 'Unknown', licenseUrl: null }])
    expect(md).toContain('| `foo`     | Unknown |')
  })

  it('preserves the order of entries in the rendered output', () => {
    const md = generateThirdPartyLicensesContent([
      { name: 'a', licenseType: 'MIT', licenseUrl: null },
      { name: 'b', licenseType: 'MIT', licenseUrl: null },
    ])
    const lines = md.split(/\r?\n/)
    const aIdx = lines.findIndex((l) => l.includes('`a`'))
    const bIdx = lines.findIndex((l) => l.includes('`b`'))
    expect(aIdx).toBeLessThan(bIdx)
  })

  it('omits the license texts section when no entry carries texts', () => {
    expect(generateThirdPartyLicensesContent([{ name: 'foo', licenseType: 'MIT', licenseUrl: null, licenseTexts: [] }])).not.toContain(
      '## License texts'
    )
  })

  it('reproduces each license file under its package and file name in a fenced block', () => {
    const md = generateThirdPartyLicensesContent([
      {
        name: 'foo',
        licenseType: 'MIT',
        licenseUrl: null,
        licenseTexts: [{ fileName: 'LICENSE', content: 'MIT License\n\nCopyright x\n' }],
      },
    ])
    expect(md).toContain('## License texts\n\n### `foo`\n\n#### LICENSE\n\n```text\nMIT License\n\nCopyright x\n```\n')
  })

  it('lists only the entries that carry texts in the license texts section', () => {
    const md = generateThirdPartyLicensesContent([
      { name: 'bare', licenseType: 'MIT', licenseUrl: null },
      { name: 'foo', licenseType: 'MIT', licenseUrl: null, licenseTexts: [{ fileName: 'LICENSE', content: 'text' }] },
    ])
    expect(md).not.toContain('### `bare`')
  })

  it('fences a license text with more backticks than any run inside it', () => {
    const md = generateThirdPartyLicensesContent([
      { name: 'foo', licenseType: 'MIT', licenseUrl: null, licenseTexts: [{ fileName: 'LICENSE', content: 'see ```code``` here' }] },
    ])
    expect(md).toContain('````text\nsee ```code``` here\n````')
  })

  it('ends the body with a single trailing newline after license texts', () => {
    const md = generateThirdPartyLicensesContent([
      { name: 'foo', licenseType: 'MIT', licenseUrl: null, licenseTexts: [{ fileName: 'LICENSE', content: 'text\n\n' }] },
    ])
    expect(md.endsWith('```\n')).toBe(true)
  })
})
