import type { CliFlags } from '../args'
import type { RunDevOptions } from './dev'
import { join } from 'node:path'
import { runDev } from './dev'

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const sink = (): { stream: NodeJS.WritableStream; text: () => string } => {
  const chunks: string[] = []
  const stream = <NodeJS.WritableStream>(<unknown>{
    write: (chunk: string): boolean => {
      chunks.push(chunk)
      return true
    },
  })
  return { stream, text: () => chunks.join('') }
}

const deps = (over: Partial<RunDevOptions>): RunDevOptions => {
  const stdout = sink()
  const stderr = sink()
  return {
    flags: mkFlags({}),
    cwd: '/project',
    stdout: stdout.stream,
    stderr: stderr.stream,
    discover: () => '/project/hf-dev.config.json',
    loadConfig: () => Promise.resolve({ apps: [{}, {}] }),
    ...over,
  }
}

describe('runDev', () => {
  it('resolves the config but exits with the pending code', async () => {
    const code = await runDev(deps({}))
    expect(code).toBe(1)
  })

  it('reports the resolved app count', async () => {
    const out = sink()
    await runDev(deps({ stdout: out.stream }))
    expect(out.text()).toEqual(expect.stringContaining('2 app(s)'))
  })

  it('explains that the dev server is not yet available', async () => {
    const err = sink()
    await runDev(deps({ stderr: err.stream }))
    expect(err.text()).toEqual(expect.stringContaining('not yet available'))
  })

  it('errors when no dev config is found', async () => {
    const err = sink()
    await runDev(deps({ discover: () => null, stderr: err.stream }))
    expect(err.text()).toEqual(expect.stringContaining('No hf-dev.config'))
  })

  it('loads an absolute --config path verbatim', async () => {
    const loadConfig = jest.fn(() => Promise.resolve({ apps: [] }))
    await runDev(deps({ flags: mkFlags({ config: '/abs/hf-dev.config.json' }), loadConfig }))
    expect(loadConfig).toHaveBeenCalledWith('/abs/hf-dev.config.json')
  })

  it('resolves a relative --config against the cwd', async () => {
    const loadConfig = jest.fn(() => Promise.resolve({ apps: [] }))
    await runDev(deps({ cwd: '/proj', flags: mkFlags({ config: 'hf-dev.config.json', cwd: '.' }), loadConfig }))
    expect(loadConfig).toHaveBeenCalledWith(join('/proj', 'hf-dev.config.json'))
  })

  it('rejects a config without an apps array', async () => {
    const err = sink()
    await runDev(deps({ loadConfig: () => Promise.resolve({}), stderr: err.stream }))
    expect(err.text()).toEqual(expect.stringContaining('"apps" array'))
  })

  it('rejects a null config', async () => {
    const code = await runDev(deps({ loadConfig: () => Promise.resolve(null) }))
    expect(code).toBe(1)
  })

  it('rejects a non-object config', async () => {
    const code = await runDev(deps({ loadConfig: () => Promise.resolve(5) }))
    expect(code).toBe(1)
  })

  it('surfaces a non-Error rejection', async () => {
    const err = sink()
    const code = await runDev(deps({ loadConfig: () => Promise.reject('boom'), stderr: err.stream }))
    expect(code).toBe(1)
  })
})
