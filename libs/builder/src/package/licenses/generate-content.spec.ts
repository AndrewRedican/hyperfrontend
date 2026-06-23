import { generateThirdPartyLicensesContent } from './generate-content'

describe('generateThirdPartyLicensesContent', () => {
  it('emits the heading and table header even when there are no entries', () => {
    const md = generateThirdPartyLicensesContent([])
    expect(md).toContain('# Third-Party Licenses')
    expect(md).toContain('| Dependency       | Link')
    expect(md.endsWith('\n')).toBe(true)
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
    const lines = md.split('\n')
    const aIdx = lines.findIndex((l) => l.includes('`a`'))
    const bIdx = lines.findIndex((l) => l.includes('`b`'))
    expect(aIdx).toBeLessThan(bIdx)
  })
})
