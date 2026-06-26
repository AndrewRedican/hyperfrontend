import type { CliFlags } from '../args'
import type { ResolvedBuildBundle } from '../config/resolve'
import type { RunBuildOptions } from './build'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from '@hyperfrontend/builder'
import { runBuild } from './build'

jest.mock('node:child_process')
jest.mock('@hyperfrontend/builder', () => ({ build: jest.fn() }))

const mockExecFileSync = jest.mocked(execFileSync)
const mockBuild = jest.mocked(build)

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const bundle = (protocol: 'none' | 'v1' | 'v2'): ResolvedBuildBundle => ({
  config: { name: 'clock', version: '1.0.0', contract: './c.json', url: '/' },
  contract: { emitted: [], accepted: [] },
  protocol,
})

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

describe('runBuild', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-build-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const deps = (over: Partial<RunBuildOptions>): RunBuildOptions => {
    const stdout = sink()
    const stderr = sink()
    return {
      flags: mkFlags({}),
      cwd: dir,
      stdout: stdout.stream,
      stderr: stderr.stream,
      resolveConfig: () => Promise.resolve(bundle('v2')),
      runBuilder: jest.fn(),
      packTarball: () => 'clock-shell-1.0.0.tgz',
      ...over,
    }
  }

  it('builds and packs successfully', async () => {
    const code = await runBuild(deps({}))
    expect(code).toBe(0)
  })

  it('invokes the builder with the resolved temp and output paths', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: expect.any(String),
        workspaceRoot: expect.any(String),
        outputPath: expect.stringContaining('dist'),
      })
    )
  })

  it('reports the packed tarball', async () => {
    const out = sink()
    await runBuild(deps({ stdout: out.stream }))
    expect(out.text()).toEqual(expect.stringContaining('Packed clock-shell-1.0.0.tgz'))
  })

  it('omits the packed line when no tarball is produced', async () => {
    const out = sink()
    await runBuild(deps({ stdout: out.stream, packTarball: () => '' }))
    expect(out.text()).toEqual(expect.not.stringContaining('Packed'))
  })

  it('previews without building under --dry-run', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ flags: mkFlags({ dryRun: true }), runBuilder }))
    expect(runBuilder).not.toHaveBeenCalled()
  })

  it('announces the dry-run in the summary', async () => {
    const out = sink()
    await runBuild(deps({ flags: mkFlags({ dryRun: true }), stdout: out.stream }))
    expect(out.text()).toEqual(expect.stringContaining('Would build'))
  })

  it('rejects a build without a security protocol', async () => {
    const err = sink()
    const code = await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none')), stderr: err.stream }))
    expect(code).toBe(1)
  })

  it('explains the missing protocol', async () => {
    const err = sink()
    await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none')), stderr: err.stream }))
    expect(err.text()).toEqual(expect.stringContaining('security protocol'))
  })

  it('honors an explicit --out and a relative --cwd', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ flags: mkFlags({ out: 'out', cwd: '.' }), runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(expect.objectContaining({ outputPath: join(dir, 'out') }))
  })

  it('accepts an absolute --out path', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ flags: mkFlags({ out: join(dir, 'abs-out') }), runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(expect.objectContaining({ outputPath: join(dir, 'abs-out') }))
  })

  it('surfaces a resolution error', async () => {
    const err = sink()
    const code = await runBuild(deps({ resolveConfig: () => Promise.reject(new Error('bad config')), stderr: err.stream }))
    expect(code).toBe(1)
  })

  it('surfaces a non-Error rejection', async () => {
    const err = sink()
    const code = await runBuild(deps({ resolveConfig: () => Promise.reject('boom'), stderr: err.stream }))
    expect(code).toBe(1)
  })

  it('resolves real config files when no resolver is injected', async () => {
    writeFileSync(join(dir, 'clock.contract.json'), '{ "emitted": [], "accepted": [] }')
    writeFileSync(
      join(dir, 'feature.config.json'),
      '{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "protocol": "v2" }'
    )
    const code = await runBuild({
      flags: mkFlags({}),
      cwd: dir,
      stdout: sink().stream,
      stderr: sink().stream,
      runBuilder: jest.fn(),
      packTarball: () => 'clock.tgz',
    })
    expect(code).toBe(0)
  })

  it('drives the builder and npm pack when no runners are injected', async () => {
    mockBuild.mockResolvedValue(<Awaited<ReturnType<typeof build>>>{})
    mockExecFileSync.mockReturnValue('clock-shell-1.0.0.tgz\n')
    await runBuild({
      flags: mkFlags({}),
      cwd: dir,
      stdout: sink().stream,
      stderr: sink().stream,
      resolveConfig: () => Promise.resolve(bundle('v2')),
    })
    expect(mockBuild).toHaveBeenCalledWith(expect.objectContaining({ esm: {}, cjs: {}, outputPath: expect.stringContaining('dist') }))
    expect(mockExecFileSync).toHaveBeenCalledWith('npm', ['pack'], expect.objectContaining({ cwd: expect.stringContaining('dist') }))
  })
})
