import type { CliFlags } from '../cli/args'
import type { ResolveDevConfigOptions } from './config'
import { resolveDevConfig, validateApps, validateDevApp, validateDevConfig } from './config'

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const opts = (over: Partial<ResolveDevConfigOptions>): ResolveDevConfigOptions => ({
  cwd: '/project',
  flags: mkFlags({}),
  discover: () => '/project/hf-dev.config.json',
  loadConfig: () => Promise.resolve({ apps: [{ name: 'clock', outputDir: './dist' }] }),
  ...over,
})

describe('validateDevApp', () => {
  it('rejects a non-object entry', () => {
    expect(() => validateDevApp(5, 0, '/p')).toThrow('apps[0] must be an object')
  })

  it('rejects a missing name', () => {
    expect(() => validateDevApp({ outputDir: './d' }, 1, '/p')).toThrow('apps[1].name')
  })

  it('rejects a missing outputDir', () => {
    expect(() => validateDevApp({ name: 'a' }, 0, '/p')).toThrow('apps[0].outputDir')
  })

  it('rejects a non-integer port', () => {
    expect(() => validateDevApp({ name: 'a', outputDir: './d', port: 80.5 }, 0, '/p')).toThrow('apps[0].port')
  })

  it('returns a valid entry', () => {
    expect(validateDevApp({ name: 'a', outputDir: './d', port: 3000 }, 0, '/p')).toEqual({ name: 'a', outputDir: './d', port: 3000 })
  })
})

describe('validateApps', () => {
  it('rejects a non-array', () => {
    expect(() => validateApps({}, '/p')).toThrow('"apps" array')
  })

  it('rejects an empty array', () => {
    expect(() => validateApps([], '/p')).toThrow('at least one app')
  })

  it('returns the validated apps', () => {
    expect(validateApps([{ name: 'a', outputDir: './d' }], '/p')).toEqual([{ name: 'a', outputDir: './d' }])
  })
})

describe('validateDevConfig', () => {
  it('rejects a non-object config', () => {
    expect(() => validateDevConfig(null, '/p')).toThrow('must be an object')
  })

  it('rejects a non-object debug block', () => {
    expect(() => validateDevConfig({ apps: [{ name: 'a', outputDir: './d' }], debug: 5 }, '/p')).toThrow('"debug" must be an object')
  })

  it('keeps a valid debug block', () => {
    expect(validateDevConfig({ apps: [{ name: 'a', outputDir: './d' }], debug: { enabled: false } }, '/p')).toEqual(
      expect.objectContaining({ debug: { enabled: false } })
    )
  })

  it('omits debug when absent', () => {
    expect(validateDevConfig({ apps: [{ name: 'a', outputDir: './d' }] }, '/p')).toEqual({ apps: [{ name: 'a', outputDir: './d' }] })
  })
})

describe('resolveDevConfig', () => {
  it('resolves outputDir against the config directory', async () => {
    const resolved = await resolveDevConfig(opts({}))
    expect(resolved.apps).toEqual([expect.objectContaining({ name: 'clock', outputDir: '/project/dist' })])
  })

  it('auto-assigns ports from 3000 for unported apps', async () => {
    const resolved = await resolveDevConfig(
      opts({
        loadConfig: () =>
          Promise.resolve({
            apps: [
              { name: 'a', outputDir: './a' },
              { name: 'b', outputDir: './b' },
            ],
          }),
      })
    )
    expect(resolved.apps.map((app) => app.port)).toEqual([3000, 3001])
  })

  it('keeps an explicit app port', async () => {
    const resolved = await resolveDevConfig(
      opts({ loadConfig: () => Promise.resolve({ apps: [{ name: 'a', outputDir: './a', port: 9000 }] }) })
    )
    expect(resolved.apps[0]?.port).toBe(9000)
  })

  it('defaults the debug toggles to enabled', async () => {
    const resolved = await resolveDevConfig(opts({}))
    expect(resolved.debug).toEqual({ enabled: true, messageLog: true, securityView: true })
  })

  it('honours explicit debug toggles', async () => {
    const resolved = await resolveDevConfig(
      opts({ loadConfig: () => Promise.resolve({ apps: [{ name: 'a', outputDir: './a' }], debug: { messageLog: false } }) })
    )
    expect(resolved.debug.messageLog).toBe(false)
  })

  it('defaults the debug port to 4280', async () => {
    expect((await resolveDevConfig(opts({}))).debugPort).toBe(4280)
  })

  it('throws when no config is discovered', async () => {
    await expect(resolveDevConfig(opts({ discover: () => null }))).rejects.toThrow('No hf-dev.config')
  })

  it('loads an absolute --config path verbatim', async () => {
    const loadConfig = jest.fn(() => Promise.resolve({ apps: [{ name: 'a', outputDir: './a' }] }))
    await resolveDevConfig(opts({ flags: mkFlags({ config: '/abs/hf-dev.config.json' }), loadConfig }))
    expect(loadConfig).toHaveBeenCalledWith('/abs/hf-dev.config.json')
  })

  it('overrides apps from --apps and resolves outputDir against the apps file', async () => {
    const loadConfig = (path: string) =>
      Promise.resolve(
        path.endsWith('apps.json') ? [{ name: 'fromFlag', outputDir: './out' }] : { apps: [{ name: 'base', outputDir: './base' }] }
      )
    const resolved = await resolveDevConfig(opts({ flags: mkFlags({ apps: '/abs/apps.json' }), loadConfig }))
    expect(resolved.apps).toEqual([expect.objectContaining({ name: 'fromFlag', outputDir: '/abs/out' })])
  })

  it('overrides the debug port from --port', async () => {
    expect((await resolveDevConfig(opts({ flags: mkFlags({ port: '5000' }) }))).debugPort).toBe(5000)
  })

  it('rejects an invalid --port', async () => {
    await expect(resolveDevConfig(opts({ flags: mkFlags({ port: 'abc' }) }))).rejects.toThrow('--port must be an integer')
  })

  it('reports the source path it loaded', async () => {
    expect((await resolveDevConfig(opts({}))).sourcePath).toBe('/project/hf-dev.config.json')
  })
})
