import { constructLicenseUrl } from './license-url'

describe('constructLicenseUrl', () => {
  it('returns null when the repository field is undefined', () => {
    expect(constructLicenseUrl(undefined, 'LICENSE')).toBeNull()
  })

  it('returns null when the repository field is an empty object', () => {
    expect(constructLicenseUrl(<never>{ type: 'git' }, 'LICENSE')).toBeNull()
  })

  it('extracts the URL from an object-form repository field', () => {
    expect(constructLicenseUrl({ type: 'git', url: 'https://github.com/x/y.git' }, 'LICENSE')).toBe(
      'https://github.com/x/y/blob/master/LICENSE'
    )
  })

  it('uses a string-form repository field directly', () => {
    expect(constructLicenseUrl('https://gitlab.com/x/y.git', 'LICENSE')).toBe('https://gitlab.com/x/y/-/blob/main/LICENSE')
  })

  it('builds a Bitbucket URL when the repository is hosted on bitbucket', () => {
    expect(constructLicenseUrl('https://bitbucket.org/x/y.git', 'LICENSE')).toBe('https://bitbucket.org/x/y/src/master/LICENSE')
  })

  it('returns null when the URL cannot be parsed', () => {
    expect(constructLicenseUrl('::not a url::', 'LICENSE')).toBeNull()
  })

  it('returns null when the platform is recognized but unsupported (azure-devops)', () => {
    expect(constructLicenseUrl('https://dev.azure.com/org/proj/_git/repo', 'LICENSE')).toBeNull()
  })

  it('returns null when the platform is unknown', () => {
    expect(constructLicenseUrl('https://example.com/x/y.git', 'LICENSE')).toBeNull()
  })
})
