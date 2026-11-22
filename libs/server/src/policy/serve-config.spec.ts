import { describe, expect, it } from '@hyperfrontend/testing'
import { checkServeConfig, isolationRules, validateHeaderRule, validateServeConfig } from './serve-config'

describe('validateHeaderRule', () => {
  it('rejects a non-object rule', () => {
    expect(() => validateHeaderRule(5, 0, '/p')).toThrow('headers[0] must be an object')
  })

  it('rejects a non-string prefix', () => {
    expect(() => validateHeaderRule({ prefix: 5, headers: {} }, 1, '/p')).toThrow('headers[1].prefix must be a string')
  })

  it('rejects a non-string suffix', () => {
    expect(() => validateHeaderRule({ suffix: 5, headers: {} }, 0, '/p')).toThrow('headers[0].suffix must be a string')
  })

  it('rejects a rule with no headers record', () => {
    expect(() => validateHeaderRule({ prefix: '/a' }, 0, '/p')).toThrow('headers[0].headers must be an object')
  })

  it('rejects a non-string header value', () => {
    expect(() => validateHeaderRule({ headers: { 'X-Test': 5 } }, 0, '/p')).toThrow('headers[0].headers["X-Test"] must be a string')
  })

  it('rejects a header name that is not an HTTP token', () => {
    expect(() => validateHeaderRule({ headers: { 'X Bad Name': 'on' } }, 0, '/p')).toThrow(
      'headers[0].headers["X Bad Name"] is not a valid header name'
    )
  })

  it('rejects a header value carrying a newline', () => {
    // why: Node's setHeader throws on control bytes at request time, so a pasted multi-line value must fail at config load instead of crashing the first request.
    expect(() => validateHeaderRule({ headers: { 'X-Policy': 'line1\nline2' } }, 0, '/p')).toThrow(
      'headers[0].headers["X-Policy"] must not contain control characters'
    )
  })

  it('rejects a header value carrying a carriage return', () => {
    expect(() => validateHeaderRule({ headers: { 'X-Policy': 'a\rb' } }, 0, '/p')).toThrow('must not contain control characters')
  })

  it('returns a minimal rule unchanged', () => {
    expect(validateHeaderRule({ headers: { 'X-Test': 'on' } }, 0, '/p')).toEqual({ headers: { 'X-Test': 'on' } })
  })

  it('returns a full rule unchanged', () => {
    const rule = { prefix: '/fish-', suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }
    expect(validateHeaderRule(rule, 0, '/p')).toEqual(rule)
  })
})

describe('validateServeConfig', () => {
  it('rejects a non-object config', () => {
    expect(() => validateServeConfig(5, '/p')).toThrow('serve config must be an object')
  })

  it('rejects a null config', () => {
    expect(() => validateServeConfig(null, '/p')).toThrow('serve config must be an object')
  })

  it('rejects an array config', () => {
    expect(() => validateServeConfig([], '/p')).toThrow('serve config must be an object')
  })

  it('rejects an empty-string root', () => {
    expect(() => validateServeConfig({ root: '' }, '/p')).toThrow('"root" must be a non-empty string')
  })

  it('rejects a non-string root', () => {
    expect(() => validateServeConfig({ root: 5 }, '/p')).toThrow('"root" must be a non-empty string')
  })

  it.each([0, 70000, 80.5, '8080'])('rejects the port %p', (port) => {
    expect(() => validateServeConfig({ port }, '/p')).toThrow('"port" must be an integer between 1 and 65535')
  })

  it.each([5, ''])('rejects the host %p', (host) => {
    expect(() => validateServeConfig({ host }, '/p')).toThrow('"host" must be a non-empty string')
  })

  it('rejects a non-boolean log', () => {
    expect(() => validateServeConfig({ log: 'yes' }, '/p')).toThrow('"log" must be a boolean')
  })

  it('rejects a non-array headers value', () => {
    expect(() => validateServeConfig({ headers: {} }, '/p')).toThrow('"headers" must be an array')
  })

  it('validates each header rule in the array', () => {
    expect(() => validateServeConfig({ headers: [{ headers: {} }, 5] }, '/p')).toThrow('headers[1] must be an object')
  })

  it('returns an empty config unchanged', () => {
    expect(validateServeConfig({}, '/p')).toEqual({})
  })

  it('returns a full valid config unchanged', () => {
    const config = { root: 'dist', port: 8080, host: '127.0.0.1', log: false, headers: [{ prefix: '/a', headers: { 'X-Test': 'on' } }] }
    expect(validateServeConfig(config, '/p')).toEqual(config)
  })
})

describe('serve config isolation', () => {
  it('rejects an unknown isolation value', () => {
    expect(() => validateServeConfig({ isolation: 'require-cors' }, '/p')).toThrow(
      '"isolation" must be one of require-corp, credentialless'
    )
  })

  it('rejects a non-string isolation value', () => {
    expect(() => validateServeConfig({ isolation: true }, '/p')).toThrow('"isolation" must be one of require-corp, credentialless')
  })

  it('accepts a declared isolation value', () => {
    expect(validateServeConfig({ isolation: 'credentialless' }, '/p')).toEqual({ isolation: 'credentialless' })
  })
})

describe('isolationRules', () => {
  it('expands to no rule when no isolation is declared', () => {
    expect(isolationRules(undefined)).toEqual([])
  })

  it('expands require-corp into the three headers that produce it', () => {
    expect(isolationRules('require-corp')).toEqual([
      {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      },
    ])
  })

  it('carries the declared credentialless value into the embedder policy', () => {
    expect(isolationRules('credentialless')).toEqual([
      {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      },
    ])
  })

  it('applies the expansion to every path by declaring neither a prefix nor a suffix', () => {
    expect(isolationRules('require-corp').filter((rule) => rule.prefix !== undefined || rule.suffix !== undefined)).toEqual([])
  })
})

describe('checkServeConfig', () => {
  it('reports nothing for an empty config', () => {
    expect(checkServeConfig({})).toEqual([])
  })

  it('reports nothing for a config that declares every field', () => {
    expect(
      checkServeConfig({
        $schema: './hf-serve.schema.json',
        root: 'dist',
        port: 8080,
        host: '127.0.0.1',
        log: false,
        isolation: 'require-corp',
        embedders: ["'self'", 'https://host.example'],
        permissionsPolicy: { camera: [], geolocation: ['self'] },
        headers: [{ prefix: '/assets/', suffix: '.js', headers: { 'Cache-Control': 'no-cache' } }],
      })
    ).toEqual([])
  })

  it.each([[5], [null], [[]], ['config']])('reports %p as the one problem of a value that is no object', (value: unknown) => {
    expect(checkServeConfig(value)).toEqual([{ code: 'config-not-object', path: '', message: 'serve config must be an object.' }])
  })

  it.each([
    [{ root: '' }, 'root-invalid', 'root', '"root" must be a non-empty string.'],
    [{ port: 0 }, 'port-invalid', 'port', '"port" must be an integer between 1 and 65535.'],
    [{ host: 5 }, 'host-invalid', 'host', '"host" must be a non-empty string.'],
    [{ log: 'yes' }, 'log-invalid', 'log', '"log" must be a boolean.'],
    [{ isolation: 'require-cors' }, 'isolation-invalid', 'isolation', '"isolation" must be one of require-corp, credentialless.'],
    [{ headers: {} }, 'headers-not-array', 'headers', '"headers" must be an array.'],
    [{ headers: null }, 'headers-not-array', 'headers', '"headers" must be an array.'],
    [{ embedders: null }, 'embedders-not-array', 'embedders', '"embedders" must be an array of sources.'],
    [{ headers: [5] }, 'rule-not-object', 'headers[0]', 'headers[0] must be an object.'],
    [{ headers: [{ prefix: 5, headers: {} }] }, 'rule-prefix-invalid', 'headers[0].prefix', 'headers[0].prefix must be a string.'],
    [{ headers: [{ suffix: 5, headers: {} }] }, 'rule-suffix-invalid', 'headers[0].suffix', 'headers[0].suffix must be a string.'],
    [{ headers: [{ prefix: '/a' }] }, 'rule-headers-not-object', 'headers[0].headers', 'headers[0].headers must be an object.'],
    [
      { headers: [{ headers: { 'X Bad': 'on' } }] },
      'header-name-invalid',
      'headers[0].headers["X Bad"]',
      'headers[0].headers["X Bad"] is not a valid header name.',
    ],
    [
      { headers: [{ headers: { 'X-Test': 5 } }] },
      'header-value-not-string',
      'headers[0].headers["X-Test"]',
      'headers[0].headers["X-Test"] must be a string.',
    ],
    [
      { headers: [{ headers: { 'X-Test': 'a\0b' } }] },
      'header-value-control-character',
      'headers[0].headers["X-Test"]',
      'headers[0].headers["X-Test"] must not contain control characters.',
    ],
    [{ embedders: 'https://host.example' }, 'embedders-not-array', 'embedders', '"embedders" must be an array of sources.'],
    [
      { permissionsPolicy: [] },
      'permissions-policy-not-object',
      'permissionsPolicy',
      '"permissionsPolicy" must be an object of feature names to allowlists.',
    ],
    [{ rooot: 'dist' }, 'unknown-field', 'rooot', '"rooot" is not a serve config field.'],
    [{ permissions: { camera: [] } }, 'unknown-field', 'permissions', '"permissions" is not a serve config field.'],
    [
      { headers: [{ headers: {} }, { prefx: '/a', headers: {} }] },
      'rule-unknown-field',
      'headers[1]',
      'headers[1] has an unknown field "prefx": a rule takes prefix, suffix and headers.',
    ],
  ])('reports %j as %s', (config: unknown, code: string, path: string, message: string) => {
    expect(checkServeConfig(config)).toEqual([{ code, path, message }])
  })

  it('reports one problem per header, the first that applies', () => {
    expect(
      checkServeConfig({ headers: [{ headers: { 'X Bad': 5, 'X-Number': 5, 'X-Fine': 'on', 'X-Split': 'a\rb' } }] }).map(
        (issue) => issue.code
      )
    ).toEqual(['header-name-invalid', 'header-value-not-string', 'header-value-control-character'])
  })

  it('collects the checks it always made first, then embedders, the permissions policy and the unknown fields', () => {
    expect(
      checkServeConfig({
        rooot: 'dist',
        permissionsPolicy: { Camera: [] },
        embedders: ['*'],
        headers: [{ prefx: '/a', prefix: 5, headers: { 'X Bad': 'on' } }, 7],
        isolation: 'x',
        log: 1,
        host: '',
        port: 0,
        root: 5,
      }).map((issue) => issue.code)
    ).toEqual([
      'root-invalid',
      'port-invalid',
      'host-invalid',
      'log-invalid',
      'isolation-invalid',
      'rule-prefix-invalid',
      'header-name-invalid',
      'rule-not-object',
      'embedder-permits-every-origin',
      'permissions-policy-name-invalid',
      'unknown-field',
      'rule-unknown-field',
    ])
  })

  it('reports a rule that drops the declared embedders after the permissions policy and ahead of the unknown fields', () => {
    expect(
      checkServeConfig({
        extra: true,
        permissionsPolicy: { Camera: [] },
        embedders: ["'self'"],
        headers: [{ suffix: '.html', headers: { 'Content-Security-Policy': "default-src 'self'" } }],
      }).map((issue) => issue.code)
    ).toEqual(['permissions-policy-name-invalid', 'embedders-dropped-by-rule', 'unknown-field'])
  })

  it('reports an unbounded rule that contradicts the declared embedders', () => {
    expect(checkServeConfig({ embedders: ["'self'"], headers: [{ headers: { 'Content-Security-Policy': 'frame-ancestors *' } }] })).toEqual(
      [
        {
          code: 'embedders-contradicted-by-rule',
          path: 'headers[0].headers["Content-Security-Policy"]',
          message:
            'headers[0].headers["Content-Security-Policy"] applies to every path with a frame-ancestors list other than the one "embedders" declares: make the two equal, bound the rule with a prefix or suffix, or remove "embedders".',
        },
      ]
    )
  })

  it('skips the interplay while a rule is malformed', () => {
    expect(
      checkServeConfig({
        embedders: ["'self'"],
        headers: [{ headers: { 'Content-Security-Policy': "default-src 'self'" } }, 5],
      }).map((issue) => issue.code)
    ).toEqual(['rule-not-object'])
  })

  it('skips the interplay while the embedders are refused', () => {
    expect(
      checkServeConfig({ embedders: ['self'], headers: [{ headers: { 'Content-Security-Policy': "default-src 'self'" } }] }).map(
        (issue) => issue.code
      )
    ).toEqual(['embedder-keyword-unquoted'])
  })

  it('judges the declared embedders against no rule when the config has none', () => {
    expect(checkServeConfig({ embedders: [] })).toEqual([])
  })

  it('accepts a bounded rule that narrows the declared embedders', () => {
    expect(
      checkServeConfig({
        embedders: ["'self'"],
        headers: [{ prefix: '/host', headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } }],
      })
    ).toEqual([])
  })

  it('reports each unknown field of a rule', () => {
    expect(checkServeConfig({ headers: [{ headers: {}, path: '/a', match: '.html' }] }).map((issue) => issue.message)).toEqual([
      'headers[0] has an unknown field "path": a rule takes prefix, suffix and headers.',
      'headers[0] has an unknown field "match": a rule takes prefix, suffix and headers.',
    ])
  })
})

describe('validateServeConfig over every problem', () => {
  it('reports each problem on its own line with the source path', () => {
    expect(() =>
      validateServeConfig({ port: 0, embedders: ['*'], permissionsPolicy: { Camera: [] }, rooot: 'dist' }, '/site/hf-serve.config.json')
    ).toThrow(
      [
        '/site/hf-serve.config.json: "port" must be an integer between 1 and 65535.',
        '/site/hf-serve.config.json: embedders[0] permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.',
        '/site/hf-serve.config.json: permissionsPolicy["Camera"] is not a feature name: use lowercase letters, digits and hyphens, starting with a letter.',
        '/site/hf-serve.config.json: "rooot" is not a serve config field.',
      ].join('\n')
    )
  })

  it('starts with the message the first problem always had', () => {
    const thrown = (): string => {
      try {
        validateServeConfig(
          { rooot: 1, embedders: 5, headers: [{ extra: 1, headers: {} }, { headers: { 'X-Test': 5 } }], log: 'yes' },
          '/p'
        )
        return ''
      } catch (error) {
        return (error as Error).message
      }
    }
    expect(thrown().split(/\r?\n/)[0]).toBe('/p: "log" must be a boolean.')
  })

  it('refuses an unknown field', () => {
    expect(() => validateServeConfig({ embedder: ["'self'"] }, '/p')).toThrow('/p: "embedder" is not a serve config field.')
  })

  it('refuses an unknown rule field', () => {
    expect(() => validateServeConfig({ headers: [{ prefx: '/a', headers: {} }] }, '/p')).toThrow(
      '/p: headers[0] has an unknown field "prefx": a rule takes prefix, suffix and headers.'
    )
  })

  it('accepts a schema reference', () => {
    expect(validateServeConfig({ $schema: './hf-serve.schema.json' }, '/p')).toEqual({ $schema: './hf-serve.schema.json' })
  })

  it('returns a config that declares embedders and a permissions policy unchanged', () => {
    const config = { embedders: ["'self'"], permissionsPolicy: { camera: [] } }
    expect(validateServeConfig(config, '/p')).toBe(config)
  })

  it('refuses a rule that drops the declared embedders', () => {
    expect(() =>
      validateServeConfig(
        { embedders: [], headers: [{ suffix: '.html', headers: { 'Content-Security-Policy': "default-src 'self'" } }] },
        '/p'
      )
    ).toThrow('/p: headers[0].headers["Content-Security-Policy"] replaces the policy "embedders" declares')
  })
})

describe('validateHeaderRule over every problem', () => {
  it('reports each problem of the rule on its own line with the source path', () => {
    expect(() => validateHeaderRule({ prefix: 5, suffix: 5, headers: { 'X Bad': 'on' }, extra: 1 }, 2, '/p')).toThrow(
      [
        '/p: headers[2].prefix must be a string.',
        '/p: headers[2].suffix must be a string.',
        '/p: headers[2].headers["X Bad"] is not a valid header name.',
        '/p: headers[2] has an unknown field "extra": a rule takes prefix, suffix and headers.',
      ].join('\n')
    )
  })
})
