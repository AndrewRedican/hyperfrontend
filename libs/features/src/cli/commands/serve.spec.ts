import type { ResolvedServeConfig } from '../../server/serve-config'
import type { StaticServeDeps, StaticServerHandle } from '../../server/static-serve'
import type { CliFlags } from '../args'
import type { RunServeOptions } from './serve'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runServe } from './serve'

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

const config: ResolvedServeConfig = {
  root: '/abs/site',
  port: 4284,
  headers: [],
  log: true,
}

const handle = (over: Partial<StaticServerHandle> = {}): StaticServerHandle => ({
  port: 4284,
  url: 'http://localhost:4284/',
  close: () => Promise.resolve(),
  ...over,
})

const deps = (over: Partial<RunServeOptions>): RunServeOptions => {
  const stdout = sink()
  const stderr = sink()
  return {
    flags: mkFlags({}),
    cwd: '/project',
    stdout: stdout.stream,
    stderr: stderr.stream,
    resolveConfig: () => Promise.resolve(config),
    startServer: () => Promise.resolve(handle()),
    waitForClose: () => Promise.resolve(),
    ...over,
  }
}

describe('runServe', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('exits with the success code after the shutdown wait resolves', async () => {
    expect(await runServe(deps({}))).toBe(0)
  })

  it('writes the root and serving url', async () => {
    const out = sink()
    await runServe(deps({ stdout: out.stream }))
    expect(out.text()).toEqual(expect.stringContaining('  /abs/site → http://localhost:4284/\n'))
  })

  it('starts the server with the resolved config and a log sink', async () => {
    const startServer = jest.fn(() => Promise.resolve(handle()))
    await runServe(deps({ startServer }))
    expect(startServer).toHaveBeenCalledWith(config, { log: expect.any(Function) })
  })

  it('forwards access-log lines to stdout with a trailing newline', async () => {
    const out = sink()
    let logDep: ((line: string) => void) | undefined
    const startServer = (_config: ResolvedServeConfig, serverDeps?: StaticServeDeps): Promise<StaticServerHandle> => {
      logDep = serverDeps?.log
      return Promise.resolve(handle())
    }
    await runServe(deps({ stdout: out.stream, startServer }))
    logDep?.('GET / 200')
    expect(out.text()).toEqual(expect.stringContaining('GET / 200\n'))
  })

  it('passes the running handle to the shutdown wait', async () => {
    const waitForClose = jest.fn(() => Promise.resolve())
    const running = handle()
    await runServe(deps({ startServer: () => Promise.resolve(running), waitForClose }))
    expect(waitForClose).toHaveBeenCalledWith(running)
  })

  it('stays pending until the shutdown wait resolves', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate
    })
    const pending = runServe(deps({ waitForClose: () => gate }))
    const early = await Promise.race([pending.then(() => 'settled'), Promise.resolve('pending')])
    release()
    await pending
    expect(early).toBe('pending')
  })

  it('closes the server after a termination signal by default', async () => {
    jest.spyOn(process, 'once').mockImplementation(<typeof process.once>((_event: string, listener: () => void) => {
      listener()
      return process
    }))
    const close = jest.fn(() => Promise.resolve())
    const code = await runServe(deps({ waitForClose: undefined, startServer: () => Promise.resolve(handle({ close })) }))
    expect({ code, closed: close.mock.calls.length }).toEqual({ code: 0, closed: 1 })
  })

  it('resolves a relative --cwd against the working directory', async () => {
    const resolveConfig = jest.fn(() => Promise.resolve(config))
    await runServe(deps({ cwd: '/root', flags: mkFlags({ cwd: 'sub' }), resolveConfig }))
    expect(resolveConfig).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/root/sub' }))
  })

  it('uses the working directory unchanged when --cwd is absent', async () => {
    const resolveConfig = jest.fn(() => Promise.resolve(config))
    await runServe(deps({ resolveConfig }))
    expect(resolveConfig).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/project' }))
  })

  it('reports a resolution error and exits non-zero', async () => {
    const err = sink()
    const code = await runServe(deps({ resolveConfig: () => Promise.reject(new Error('boom')), stderr: err.stream }))
    expect({ code, err: err.text() }).toEqual({ code: 1, err: expect.stringContaining('boom') })
  })

  it('surfaces a non-Error rejection', async () => {
    const err = sink()
    await runServe(deps({ startServer: () => Promise.reject('kaboom'), stderr: err.stream }))
    expect(err.text()).toEqual(expect.stringContaining('kaboom'))
  })

  it('reports a missing root through the default config resolver', async () => {
    // why: A real temp cwd with a nonexistent --root fails resolution before any server starts, exercising the default resolver and server deps.
    const dir = mkdtempSync(join(tmpdir(), 'hf-serve-cmd-'))
    const err = sink()
    const code = await runServe(
      deps({ cwd: dir, flags: mkFlags({ root: 'missing-root' }), resolveConfig: undefined, startServer: undefined, stderr: err.stream })
    )
    rmSync(dir, { recursive: true, force: true })
    expect({ code, err: err.text() }).toEqual({ code: 1, err: expect.stringContaining('Serve root does not exist') })
  })
})
