import type { CliFlags } from '../cli/args'
import type { ResolveServeConfigOptions } from './serve-config'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveServeConfig, validateHeaderRule, validateServeConfig } from './serve-config'

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const opts = (over: Partial<ResolveServeConfigOptions>): ResolveServeConfigOptions => ({
  cwd: '/project',
  flags: mkFlags({}),
  discover: () => '/project/hf-serve.config.json',
  loadConfig: () => Promise.resolve({}),
  exists: () => true,
  ...over,
})

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

describe('resolveServeConfig', () => {
  it('loads an absolute --config path verbatim', async () => {
    const loadConfig = jest.fn(() => Promise.resolve({}))
    await resolveServeConfig(opts({ flags: mkFlags({ config: '/abs/hf-serve.config.json' }), loadConfig }))
    expect(loadConfig).toHaveBeenCalledWith('/abs/hf-serve.config.json')
  })

  it('resolves a relative --config path against the working directory', async () => {
    const loadConfig = jest.fn(() => Promise.resolve({}))
    await resolveServeConfig(opts({ flags: mkFlags({ config: 'conf/hf-serve.config.json' }), loadConfig }))
    expect(loadConfig).toHaveBeenCalledWith('/project/conf/hf-serve.config.json')
  })

  it('loads the artifact-carried config inside --root without discovery', async () => {
    const discover = jest.fn(() => null)
    const loadConfig = jest.fn(() => Promise.resolve({}))
    const resolved = await resolveServeConfig(opts({ flags: mkFlags({ root: './site' }), discover, loadConfig }))
    expect({ discovered: discover.mock.calls.length, loaded: loadConfig.mock.calls, sourcePath: resolved.sourcePath }).toEqual({
      discovered: 0,
      loaded: [['/project/site/hf-serve.config.json']],
      sourcePath: '/project/site/hf-serve.config.json',
    })
  })

  it('falls back to cwd discovery when the root carries no config', async () => {
    const discover = jest.fn(() => '/project/hf-serve.config.json')
    const loadConfig = jest.fn(() => Promise.resolve({}))
    await resolveServeConfig(
      opts({ flags: mkFlags({ root: '/site' }), exists: (path) => path !== '/site/hf-serve.config.json', discover, loadConfig })
    )
    expect({ discovered: discover.mock.calls, loaded: loadConfig.mock.calls }).toEqual({
      discovered: [['/project', 'hf-serve.config']],
      loaded: [['/project/hf-serve.config.json']],
    })
  })

  it('reports the discovered source path', async () => {
    expect((await resolveServeConfig(opts({}))).sourcePath).toBe('/project/hf-serve.config.json')
  })

  it('serves the working directory with pure defaults when nothing is discovered', async () => {
    const resolved = await resolveServeConfig(opts({ discover: () => null }))
    expect(resolved).toEqual({ root: '/project', port: 4284, headers: [], log: true })
  })

  it('prefers --root over the config root', async () => {
    const resolved = await resolveServeConfig(
      opts({
        flags: mkFlags({ root: '/flag-root' }),
        exists: (path) => path !== '/flag-root/hf-serve.config.json',
        loadConfig: () => Promise.resolve({ root: './config-root' }),
      })
    )
    expect(resolved.root).toBe('/flag-root')
  })

  it('resolves the config root against the config file directory, not the cwd', async () => {
    const resolved = await resolveServeConfig(
      opts({ discover: () => '/elsewhere/hf-serve.config.json', loadConfig: () => Promise.resolve({ root: './site' }) })
    )
    expect(resolved.root).toBe('/elsewhere/site')
  })

  it('throws when the serve root does not exist', async () => {
    await expect(resolveServeConfig(opts({ exists: () => false }))).rejects.toThrow('Serve root does not exist: /project')
  })

  it('prefers --port over the config port', async () => {
    const resolved = await resolveServeConfig(opts({ flags: mkFlags({ port: '5000' }), loadConfig: () => Promise.resolve({ port: 9000 }) }))
    expect(resolved.port).toBe(5000)
  })

  it.each(['0', 'abc'])('rejects the invalid --port value %s', async (raw) => {
    await expect(resolveServeConfig(opts({ flags: mkFlags({ port: raw }) }))).rejects.toThrow(
      '--port must be an integer between 1 and 65535'
    )
  })

  it('takes the port from the config when no flag is given', async () => {
    expect((await resolveServeConfig(opts({ loadConfig: () => Promise.resolve({ port: 9000 }) }))).port).toBe(9000)
  })

  it('prefers --host over the config host', async () => {
    const resolved = await resolveServeConfig(
      opts({ flags: mkFlags({ host: '127.0.0.1' }), loadConfig: () => Promise.resolve({ host: '0.0.0.0' }) })
    )
    expect(resolved.host).toBe('127.0.0.1')
  })

  it('takes the host from the config when no flag is given', async () => {
    expect((await resolveServeConfig(opts({ loadConfig: () => Promise.resolve({ host: '0.0.0.0' }) }))).host).toBe('0.0.0.0')
  })

  it('honours a config that disables logging', async () => {
    expect((await resolveServeConfig(opts({ loadConfig: () => Promise.resolve({ log: false }) }))).log).toBe(false)
  })

  it('keeps the config header rules', async () => {
    const headers = [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }]
    expect((await resolveServeConfig(opts({ loadConfig: () => Promise.resolve({ headers }) }))).headers).toEqual(headers)
  })
})

describe('default file system', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-serve-config-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves pure defaults when no config exists on disk', async () => {
    const resolved = await resolveServeConfig({ cwd: dir, flags: mkFlags({}) })
    expect(resolved).toEqual({ root: dir, port: 4284, headers: [], log: true })
  })

  it('discovers and loads a JSON config from disk when no overrides are given', async () => {
    writeFileSync(join(dir, 'hf-serve.config.json'), '{ "port": 5150 }')
    const resolved = await resolveServeConfig({ cwd: dir, flags: mkFlags({}) })
    expect({ port: resolved.port, sourcePath: resolved.sourcePath }).toEqual({ port: 5150, sourcePath: join(dir, 'hf-serve.config.json') })
  })
})
