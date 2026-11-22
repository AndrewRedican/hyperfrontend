import { describe, expect, it } from '@hyperfrontend/testing'
import { checkPermissionsPolicy, permissionsPolicy } from './permissions-policy'

const NOT_ORIGIN = 'is not an origin: expected self, "*" or scheme://host with an optional port, in lowercase ASCII with no path.'

describe('checkPermissionsPolicy', () => {
  it.each([
    [{}],
    [{ camera: [] }],
    [{ camera: ['self'] }],
    [{ fullscreen: ['*'] }],
    [{ geolocation: ['self', 'https://maps.example'] }],
    [{ 'publickey-credentials-get': ['https://*.host.example:8443'] }],
    [{ 'ch-ua-wow64': ['self'] }],
    [{ 'a-feature-no-browser-knows': [] }],
  ])('accepts %j', (features: unknown) => {
    expect(checkPermissionsPolicy(features)).toEqual([])
  })

  it.each([[5], [null], [[]], ['camera']])('reports %p as no object', (value: unknown) => {
    expect(checkPermissionsPolicy(value)).toEqual([
      {
        code: 'permissions-policy-not-object',
        path: 'permissionsPolicy',
        message: '"permissionsPolicy" must be an object of feature names to allowlists.',
      },
    ])
  })

  it.each([['Camera'], ['1x'], ['camera_roll'], ['']])('reports %p as no feature name', (name: string) => {
    const path = `permissionsPolicy[${JSON.stringify(name)}]`
    expect(checkPermissionsPolicy({ [name]: [] })).toEqual([
      {
        code: 'permissions-policy-name-invalid',
        path,
        message: `${path} is not a feature name: use lowercase letters, digits and hyphens, starting with a letter.`,
      },
    ])
  })

  it('quotes a feature name the way JSON does', () => {
    expect(checkPermissionsPolicy({ 'a"b': [] }).map((issue) => issue.path)).toEqual(['permissionsPolicy["a\\"b"]'])
  })

  it('reports an allowlist that is no array', () => {
    expect(checkPermissionsPolicy({ camera: 'self' })).toEqual([
      {
        code: 'permissions-policy-allowlist-not-array',
        path: 'permissionsPolicy["camera"]',
        message:
          'permissionsPolicy["camera"] must be an array: [] disables the feature, ["self"] keeps it for this origin, ["*"] allows every origin.',
      },
    ])
  })

  it.each([
    [[5], 0, 'permissions-policy-entry-not-string', 'must be a string.'],
    [['*', 'self'], 0, 'permissions-policy-wildcard-not-alone', 'is "*", which must be the only entry.'],
    [['self', '*'], 1, 'permissions-policy-wildcard-not-alone', 'is "*", which must be the only entry.'],
    [["'self'"], 0, 'permissions-policy-keyword-quoted', "is quoted: write self without quotes, and an empty array in place of 'none'."],
    [
      ['"https://maps.example"'],
      0,
      'permissions-policy-keyword-quoted',
      "is quoted: write self without quotes, and an empty array in place of 'none'.",
    ],
    [['https://host.example/'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [['https:'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [['src'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [['https://Host.example'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [['https://a.example https://b.example'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [['https://a.example,https://b.example'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [['https://bücher.example'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [['https://host.example\n'], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
    [[''], 0, 'permissions-policy-origin-invalid', NOT_ORIGIN],
  ])('reports the allowlist %j at entry %d as %s', (allowlist: unknown[], index: number, code: string, text: string) => {
    const path = `permissionsPolicy["camera"][${index}]`
    expect(checkPermissionsPolicy({ camera: allowlist })).toEqual([{ code, path, message: `${path} ${text}` }])
  })

  it('reports every problem of a record at once', () => {
    expect(
      checkPermissionsPolicy({ Camera: [], camera: ["'self'", 5], geolocation: 'self', fullscreen: ['*'] }).map(
        (issue) => `${issue.path}: ${issue.code}`
      )
    ).toEqual([
      'permissionsPolicy["Camera"]: permissions-policy-name-invalid',
      'permissionsPolicy["camera"][0]: permissions-policy-keyword-quoted',
      'permissionsPolicy["camera"][1]: permissions-policy-entry-not-string',
      'permissionsPolicy["geolocation"]: permissions-policy-allowlist-not-array',
    ])
  })
})

describe('permissionsPolicy', () => {
  it.each([
    [{ camera: [] }, 'camera=()'],
    [{ camera: [], geolocation: ['self'], fullscreen: ['*'] }, 'camera=(), geolocation=(self), fullscreen=*'],
    [{ geolocation: ['self', 'https://maps.example'] }, 'geolocation=(self "https://maps.example")'],
    [{ 'publickey-credentials-get': ['https://*.host.example:8443'] }, 'publickey-credentials-get=("https://*.host.example:8443")'],
  ])('serialises %j', (features: Record<string, string[]>, value: string) => {
    expect(permissionsPolicy(features)).toEqual({ headers: { 'Permissions-Policy': value } })
  })

  it('emits no header for an empty record', () => {
    expect(permissionsPolicy({})).toEqual({ headers: {} })
  })

  it('keeps the authored feature order', () => {
    expect(permissionsPolicy({ microphone: [], camera: [], accelerometer: ['self'] }).headers['Permissions-Policy']).toBe(
      'microphone=(), camera=(), accelerometer=(self)'
    )
  })

  it('bounds the rule by the scope', () => {
    expect(permissionsPolicy({ camera: [] }, { suffix: '.html' })).toEqual({
      suffix: '.html',
      headers: { 'Permissions-Policy': 'camera=()' },
    })
  })

  it('throws the problems of the record and of the scope together', () => {
    expect(() => permissionsPolicy({ camera: ["'self'"] }, { prefix: 5 as unknown as string })).toThrow(
      'permissionsPolicy["camera"][0] is quoted: write self without quotes, and an empty array in place of \'none\'.\nscope.prefix must be a string.'
    )
  })
})
