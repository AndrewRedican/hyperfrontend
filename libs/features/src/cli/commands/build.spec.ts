import type { CliFlags } from '../args'
import type { ResolvedBuildBundle } from '../config/resolve'
import type { RunBuildOptions } from './build'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { build } from '@hyperfrontend/builder'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { runBuild } from './build'

jest.mock('node:child_process')
jest.mock('@hyperfrontend/builder', () => ({ build: jest.fn() }))

const mockExecFileSync = jest.mocked(execFileSync)
const mockBuild = jest.mocked(build)

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const bundle = (protocol: 'none' | 'v1' | 'v2', protocolExplicit = false): ResolvedBuildBundle => ({
  config: { name: 'clock', version: '1.0.0', contract: './c.json', url: '/', protocol },
  contract: { emitted: [], accepted: [] },
  protocol,
  protocolExplicit,
})

const sink = (): { stream: NodeJS.WritableStream; text: () => string } => {
  const chunks: string[] = []
  const stream = {
    write: (chunk: string): boolean => {
      chunks.push(chunk)
      return true
    },
  } as unknown as NodeJS.WritableStream
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

  it('invokes the builder with the consumer project as the workspace root', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: expect.any(String),
        workspaceRoot: dir,
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

  it('rejects an explicit protocol none without the acknowledgment flag', async () => {
    const code = await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none', true)) }))
    expect(code).toBe(1)
  })

  it('names --allow-open and the risk when an explicit none is unacknowledged', async () => {
    const err = sink()
    await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none', true)), stderr: err.stream }))
    expect(err.text()).toEqual(expect.stringContaining('--allow-open'))
  })

  it('builds an explicit protocol none when --allow-open acknowledges it', async () => {
    const code = await runBuild(deps({ flags: mkFlags({ allowOpen: true }), resolveConfig: () => Promise.resolve(bundle('none', true)) }))
    expect(code).toBe(0)
  })

  it('warns on stderr when building an acknowledged open shell', async () => {
    const err = sink()
    await runBuild(
      deps({ flags: mkFlags({ allowOpen: true }), resolveConfig: () => Promise.resolve(bundle('none', true)), stderr: err.stream })
    )
    expect(err.text()).toEqual(expect.stringContaining('Warning: building an open shell'))
  })

  it('stages the shell in a hidden dir inside the working directory', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: expect.stringContaining(join(dir, '.hf-shell-clock-')) })
    )
  })

  it('stages a tsconfig anchored to the src root dir', async () => {
    let staged = ''
    const runBuilder = jest.fn((input: { projectRoot: string }) => {
      staged = readFileSync(join(input.projectRoot, 'tsconfig.lib.json'), 'utf-8')
      return Promise.resolve()
    })
    await runBuild(deps({ runBuilder }))
    expect(staged).toEqual(expect.stringContaining('"rootDir": "src"'))
  })

  it('honors an explicit --out and a relative --cwd', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ flags: mkFlags({ out: 'out', cwd: '.' }), runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(expect.objectContaining({ outputPath: join(dir, 'out') }))
  })

  it('publishes the staged README beside the built package', async () => {
    await runBuild(deps({}))
    expect(readFileSync(join(dir, 'dist', 'clock-shell', 'README.md'), 'utf-8')).toContain('# clock-shell')
  })

  it('publishes the staged metadata beside the built package', async () => {
    await runBuild(deps({}))
    expect(readFileSync(join(dir, 'dist', 'clock-shell', 'metadata.json'), 'utf-8')).toContain('"protocol": "v2"')
  })

  it('lists metadata.json in the built manifest files array so npm pack ships it', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'package.json'), '{ "name": "clock-shell", "files": ["**/index.*"] }')
      return Promise.resolve()
    })
    const out = join(dir, 'dist', 'clock-shell')
    mkdirSync(out, { recursive: true })
    await runBuild(deps({ runBuilder }))
    expect(parse(readFileSync(join(out, 'package.json'), 'utf-8'))).toEqual(
      expect.objectContaining({ files: ['**/index.*', 'metadata.json'] })
    )
  })

  it('leaves a built manifest without a files array untouched', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'package.json'), '{ "name": "clock-shell" }')
      return Promise.resolve()
    })
    const out = join(dir, 'dist', 'clock-shell')
    mkdirSync(out, { recursive: true })
    await runBuild(deps({ runBuilder }))
    expect(parse(readFileSync(join(out, 'package.json'), 'utf-8'))).not.toHaveProperty('files')
  })

  it('normalizes declaration-map sources before packing', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'index.d.ts.map'), '{"version":3,"sources":["../../.hf-shell-clock-123/src/index.ts"]}')
      return Promise.resolve()
    })
    const out = join(dir, 'dist', 'clock-shell')
    mkdirSync(out, { recursive: true })
    await runBuild(deps({ runBuilder }))
    expect(readFileSync(join(out, 'index.d.ts.map'), 'utf-8')).toBe('{"version":3,"sources":["clock/src/index.ts"]}')
  })

  it('notes a malformed declaration map on stderr without failing the build', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'index.d.ts.map'), 'not json')
      return Promise.resolve()
    })
    mkdirSync(join(dir, 'dist', 'clock-shell'), { recursive: true })
    const err = sink()
    const code = await runBuild(deps({ runBuilder, stderr: err.stream }))
    expect({ code, note: err.text() }).toEqual({ code: 0, note: expect.stringContaining('Skipping malformed declaration map') })
  })

  it('defaults the output to a per-shell directory under dist', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(expect.objectContaining({ outputPath: join(dir, 'dist', 'clock-shell') }))
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
    mockBuild.mockResolvedValue({} as Awaited<ReturnType<typeof build>>)
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
