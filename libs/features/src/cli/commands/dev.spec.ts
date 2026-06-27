import type { ResolvedDevConfig } from '../../server/config'
import type { DevServerHandle } from '../../server/dev-server'
import type { CliFlags } from '../args'
import type { RunDevOptions } from './dev'
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

const config: ResolvedDevConfig = {
  apps: [{ name: 'clock', outputDir: '/abs/dist', port: 3000 }],
  debug: { enabled: true, messageLog: true, securityView: true },
  debugPort: 4280,
  sourcePath: '/project/hf-dev.config.json',
}

const handle = (over: Partial<DevServerHandle> = {}): DevServerHandle => ({
  apps: [{ name: 'clock', port: 3000, url: 'http://localhost:3000/' }],
  manifest: { apps: [{ name: 'clock', url: 'http://localhost:3000/' }], debug: config.debug },
  debugUrl: 'http://localhost:4280/',
  close: () => Promise.resolve(),
  ...over,
})

const deps = (over: Partial<RunDevOptions>): RunDevOptions => {
  const stdout = sink()
  const stderr = sink()
  return {
    flags: mkFlags({}),
    cwd: '/project',
    stdout: stdout.stream,
    stderr: stderr.stream,
    resolveConfig: () => Promise.resolve(config),
    startServer: () => Promise.resolve(handle()),
    ...over,
  }
}

describe('runDev', () => {
  it('exits with the success code once the server is listening', async () => {
    expect(await runDev(deps({}))).toBe(0)
  })

  it('writes each running app url', async () => {
    const out = sink()
    await runDev(deps({ stdout: out.stream }))
    expect(out.text()).toEqual(expect.stringContaining('clock → http://localhost:3000/'))
  })

  it('writes the debug url when the debug UI is enabled', async () => {
    const out = sink()
    await runDev(deps({ stdout: out.stream }))
    expect(out.text()).toEqual(expect.stringContaining('Debug UI: http://localhost:4280/'))
  })

  it('omits the debug url when the debug UI is disabled', async () => {
    const out = sink()
    await runDev(deps({ stdout: out.stream, startServer: () => Promise.resolve(handle({ debugUrl: undefined })) }))
    expect(out.text()).not.toEqual(expect.stringContaining('Debug UI:'))
  })

  it('starts the server with the resolved config', async () => {
    const startServer = jest.fn(() => Promise.resolve(handle()))
    await runDev(deps({ startServer }))
    expect(startServer).toHaveBeenCalledWith(config)
  })

  it('resolves a relative --cwd against the working directory', async () => {
    const resolveConfig = jest.fn(() => Promise.resolve(config))
    await runDev(deps({ cwd: '/root', flags: mkFlags({ cwd: 'sub' }), resolveConfig }))
    expect(resolveConfig).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/root/sub' }))
  })

  it('reports a resolution error and exits non-zero', async () => {
    const err = sink()
    const code = await runDev(deps({ resolveConfig: () => Promise.reject(new Error('boom')), stderr: err.stream }))
    expect({ code, err: err.text() }).toEqual({ code: 1, err: expect.stringContaining('boom') })
  })

  it('surfaces a non-Error rejection', async () => {
    const err = sink()
    await runDev(deps({ startServer: () => Promise.reject('kaboom'), stderr: err.stream }))
    expect(err.text()).toEqual(expect.stringContaining('kaboom'))
  })
})
