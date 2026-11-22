import type { CliFlags } from '../cli/args'
import type { ResolveServeConfigOptions } from './serve-config'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { resolveServeConfig } from './serve-config'

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const opts = (over: Partial<ResolveServeConfigOptions>): ResolveServeConfigOptions => ({
  cwd: '/project',
  flags: mkFlags({}),
  discover: () => '/project/hf-serve.config.json',
  loadConfig: () => Promise.resolve({}),
  exists: () => true,
  // why: Hermetic by default — a PORT in the developer's real environment must not leak into these fixtures.
  env: {},
  ...over,
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
    expect(loadConfig).toHaveBeenCalledWith(resolve('/project/conf/hf-serve.config.json'))
  })

  it('loads the artifact-carried config inside --root without discovery', async () => {
    const discover = jest.fn(() => null)
    const loadConfig = jest.fn(() => Promise.resolve({}))
    const resolved = await resolveServeConfig(opts({ flags: mkFlags({ root: './site' }), discover, loadConfig }))
    expect({ discovered: discover.mock.calls.length, loaded: loadConfig.mock.calls, sourcePath: resolved.sourcePath }).toEqual({
      discovered: 0,
      loaded: [[resolve('/project/site/hf-serve.config.json')]],
      sourcePath: resolve('/project/site/hf-serve.config.json'),
    })
  })

  it('falls back to cwd discovery when the root carries no config', async () => {
    const discover = jest.fn(() => '/project/hf-serve.config.json')
    const loadConfig = jest.fn(() => Promise.resolve({}))
    await resolveServeConfig(
      opts({ flags: mkFlags({ root: '/site' }), exists: (path) => path !== join('/site', 'hf-serve.config.json'), discover, loadConfig })
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
        exists: (path) => path !== join('/flag-root', 'hf-serve.config.json'),
        loadConfig: () => Promise.resolve({ root: './config-root' }),
      })
    )
    expect(resolved.root).toBe('/flag-root')
  })

  it('resolves the config root against the config file directory, not the cwd', async () => {
    const resolved = await resolveServeConfig(
      opts({ discover: () => '/elsewhere/hf-serve.config.json', loadConfig: () => Promise.resolve({ root: './site' }) })
    )
    expect(resolved.root).toBe(resolve('/elsewhere/site'))
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

  it('takes the platform PORT when no flag is given', async () => {
    expect((await resolveServeConfig(opts({ env: { PORT: '8125' } }))).port).toBe(8125)
  })

  it('lets the platform PORT beat the config port', async () => {
    // why: The config travels inside the artifact; the platform assigns the socket — a baked port must not fight the injected one.
    const resolved = await resolveServeConfig(opts({ env: { PORT: '8125' }, loadConfig: () => Promise.resolve({ port: 9000 }) }))
    expect(resolved.port).toBe(8125)
  })

  it('prefers --port over the platform PORT', async () => {
    expect((await resolveServeConfig(opts({ flags: mkFlags({ port: '5000' }), env: { PORT: '8125' } }))).port).toBe(5000)
  })

  it('never reads a malformed PORT that an explicit --port outranks', async () => {
    expect((await resolveServeConfig(opts({ flags: mkFlags({ port: '5000' }), env: { PORT: 'abc' } }))).port).toBe(5000)
  })

  it.each(['0', 'abc'])('rejects the invalid PORT value %s', async (raw) => {
    await expect(resolveServeConfig(opts({ env: { PORT: raw } }))).rejects.toThrow('PORT must be an integer between 1 and 65535')
  })

  it('treats an empty PORT as unset', async () => {
    expect((await resolveServeConfig(opts({ env: { PORT: '' }, loadConfig: () => Promise.resolve({ port: 9000 }) }))).port).toBe(9000)
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
  const tmp = useTempDir({ prefix: 'hf-serve-config-' })

  beforeEach(() => {
    // why: These tests exercise the real process.env default, so a PORT from the surrounding shell is parked and restored.
    jest.stubEnv('PORT', undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('serves pure defaults when no config exists on disk', async () => {
    const resolved = await resolveServeConfig({ cwd: tmp.path, flags: mkFlags({}) })
    expect(resolved).toEqual({ root: tmp.path, port: 4284, headers: [], log: true })
  })

  it('discovers and loads a JSON config from disk when no overrides are given', async () => {
    tmp.write('hf-serve.config.json', '{ "port": 5150 }')
    const resolved = await resolveServeConfig({ cwd: tmp.path, flags: mkFlags({}) })
    expect({ port: resolved.port, sourcePath: resolved.sourcePath }).toEqual({
      port: 5150,
      sourcePath: tmp.resolve('hf-serve.config.json'),
    })
  })

  it('reads the platform PORT from the real environment by default', async () => {
    tmp.write('hf-serve.config.json', '{ "port": 5150 }')
    jest.stubEnv('PORT', '6060')
    const resolved = await resolveServeConfig({ cwd: tmp.path, flags: mkFlags({}) })
    expect(resolved.port).toBe(6060)
  })
})

describe('serve config isolation', () => {
  it('expands a declared isolation into the three headers that produce it', async () => {
    const resolved = await resolveServeConfig(opts({ loadConfig: () => Promise.resolve({ isolation: 'require-corp' }) }))
    expect(resolved.headers).toEqual([
      {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      },
    ])
  })

  it('places the expansion before the authored rules so an explicit rule still overrides', async () => {
    const resolved = await resolveServeConfig(
      opts({
        loadConfig: () =>
          Promise.resolve({ isolation: 'require-corp', headers: [{ headers: { 'Cross-Origin-Embedder-Policy': 'credentialless' } }] }),
      })
    )
    expect(resolved.headers).toEqual([
      expect.objectContaining({ headers: expect.objectContaining({ 'Cross-Origin-Opener-Policy': 'same-origin' }) }),
      { headers: { 'Cross-Origin-Embedder-Policy': 'credentialless' } },
    ])
  })

  it('leaves the header rules untouched when no isolation is declared', async () => {
    const resolved = await resolveServeConfig(opts({ loadConfig: () => Promise.resolve({ headers: [{ headers: { 'X-Test': 'on' } }] }) }))
    expect(resolved.headers).toEqual([{ headers: { 'X-Test': 'on' } }])
  })
})

describe('serve config header policy', () => {
  it('places embedders ahead of the permissions policy, isolation and the authored rules', async () => {
    const resolved = await resolveServeConfig(
      opts({
        loadConfig: () =>
          Promise.resolve({
            headers: [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }],
            isolation: 'credentialless',
            permissionsPolicy: { camera: [], geolocation: ['self'] },
            embedders: ["'self'"],
          }),
      })
    )
    expect(resolved.headers).toEqual([
      { headers: { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' } },
      { headers: { 'Permissions-Policy': 'camera=(), geolocation=(self)' } },
      {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      },
      { suffix: '.html', headers: { 'Cache-Control': 'no-cache' } },
    ])
  })

  it('resolves the same rules for a config rewritten to embedders', async () => {
    const cache = { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
    const written = { headers: [{ headers: { 'Content-Security-Policy': "frame-ancestors 'self' https://host.example" } }, cache] }
    const rewritten = { embedders: ["'self'", 'https://host.example'], headers: [cache] }
    const before = await resolveServeConfig(opts({ loadConfig: () => Promise.resolve(written) }))
    const after = await resolveServeConfig(opts({ loadConfig: () => Promise.resolve(rewritten) }))
    expect(after.headers).toEqual(before.headers)
  })

  it('sends no rule for an empty permissions policy', async () => {
    const resolved = await resolveServeConfig(opts({ loadConfig: () => Promise.resolve({ permissionsPolicy: {} }) }))
    expect(resolved.headers).toEqual([])
  })

  it('rejects refused embedders with the source path on every line', async () => {
    const lines = await resolveServeConfig(
      opts({ loadConfig: () => Promise.resolve({ embedders: ['*', 'https://host.example/app'] }) })
    ).then(
      () => [],
      (error: Error) => error.message.split(/\r?\n/)
    )
    expect(lines).toEqual([
      expect.stringMatching(/^\/project\/hf-serve\.config\.json: embedders\[0\] permits every origin/),
      expect.stringMatching(/^\/project\/hf-serve\.config\.json: embedders\[1\] must end at the host or port/),
    ])
  })

  it('rejects an authored policy that drops the declared embedders', async () => {
    const config = { embedders: ["'self'"], headers: [{ suffix: '.html', headers: { 'Content-Security-Policy': "default-src 'self'" } }] }
    await expect(resolveServeConfig(opts({ loadConfig: () => Promise.resolve(config) }))).rejects.toThrow(
      /^\/project\/hf-serve\.config\.json: headers\[0\]\.headers\["Content-Security-Policy"\] replaces the policy "embedders" declares/
    )
  })
})
