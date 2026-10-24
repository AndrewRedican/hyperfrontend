import type { CliFlags } from '../args'
import type { ResolvedBuildBundle } from '../config/resolve'
import type { RunBuildOptions } from './build'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from '@hyperfrontend/builder'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createCapturedOutput } from '@hyperfrontend/testing/process'
import { runBuild } from './build'

jest.mock('node:child_process')
jest.mock('@hyperfrontend/builder', () => ({ build: jest.fn() }))

const mockExecFileSync = jest.mocked(execFileSync)
const mockBuild = jest.mocked(build)

const mkFlags = (over: Partial<CliFlags>): CliFlags => ({ ci: false, yes: false, dryRun: false, help: false, ...over })

const bundle = (protocol: 'none' | 'v3' | 'v4', protocolExplicit = false): ResolvedBuildBundle => ({
  config: { name: 'clock', version: '1.0.0', contract: './c.json', url: '/', protocol },
  contract: { emitted: [], accepted: [] },
  protocol,
  protocolExplicit,
})

describe('runBuild', () => {
  const tmp = useTempDir({ prefix: 'hf-build-' })

  const deps = (over: Partial<RunBuildOptions>): RunBuildOptions => {
    const stdout = createCapturedOutput()
    const stderr = createCapturedOutput()
    return {
      flags: mkFlags({}),
      cwd: tmp.path,
      stdout,
      stderr,
      resolveConfig: () => Promise.resolve(bundle('v4')),
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
        workspaceRoot: tmp.path,
        outputPath: expect.stringContaining(tmp.resolve('.hf-shell-clock-')),
      })
    )
  })

  it('emits into the staging dir rather than --out so the builder only ever cleans a dir this build created', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ flags: mkFlags({ out: 'out' }), runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(expect.objectContaining({ outputPath: expect.not.stringContaining(tmp.resolve('out')) }))
  })

  it('reports the packed tarball', async () => {
    const out = createCapturedOutput()
    await runBuild(deps({ stdout: out }))
    expect(out.text()).toEqual(expect.stringContaining('Packed clock-shell-1.0.0.tgz'))
  })

  it('omits the packed line when no tarball is produced', async () => {
    const out = createCapturedOutput()
    await runBuild(deps({ stdout: out, packTarball: () => '' }))
    expect(out.text()).toEqual(expect.not.stringContaining('Packed'))
  })

  it('previews without building under --dry-run', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ flags: mkFlags({ dryRun: true }), runBuilder }))
    expect(runBuilder).not.toHaveBeenCalled()
  })

  it('announces the dry-run in the summary', async () => {
    const out = createCapturedOutput()
    await runBuild(deps({ flags: mkFlags({ dryRun: true }), stdout: out }))
    expect(out.text()).toEqual(expect.stringContaining('Would build'))
  })

  it('rejects a build without a security protocol', async () => {
    const err = createCapturedOutput()
    const code = await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none')), stderr: err }))
    expect(code).toBe(1)
  })

  it('names the v3 and v4 protocols when the build has none', async () => {
    const err = createCapturedOutput()
    await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none')), stderr: err }))
    expect(err.text()).toBe('Build requires a security protocol: pass --protocol v3 or --protocol v4.\n')
  })

  it('builds a v3 shell without a shared key', async () => {
    const code = await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('v3', true)) }))
    expect(code).toBe(0)
  })

  it('rejects an explicit protocol none without the acknowledgment flag', async () => {
    const code = await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none', true)) }))
    expect(code).toBe(1)
  })

  it('names --allow-open, the risk, and the v3/v4 alternatives when an explicit none is unacknowledged', async () => {
    const err = createCapturedOutput()
    await runBuild(deps({ resolveConfig: () => Promise.resolve(bundle('none', true)), stderr: err }))
    expect(err.text()).toBe(
      "Building with an explicit protocol 'none' produces an open shell: the channel is unauthenticated and any page can embed and message the feature. Pass --allow-open to acknowledge the risk, or pick --protocol v3 / --protocol v4.\n"
    )
  })

  it('builds an explicit protocol none when --allow-open acknowledges it', async () => {
    const code = await runBuild(deps({ flags: mkFlags({ allowOpen: true }), resolveConfig: () => Promise.resolve(bundle('none', true)) }))
    expect(code).toBe(0)
  })

  it('warns on stderr when building an acknowledged open shell', async () => {
    const err = createCapturedOutput()
    await runBuild(deps({ flags: mkFlags({ allowOpen: true }), resolveConfig: () => Promise.resolve(bundle('none', true)), stderr: err }))
    expect(err.text()).toEqual(expect.stringContaining('Warning: building an open shell'))
  })

  it('stages the shell in a hidden dir inside the working directory', async () => {
    const runBuilder = jest.fn()
    await runBuild(deps({ runBuilder }))
    expect(runBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: expect.stringContaining(tmp.resolve('.hf-shell-clock-')) })
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
    await runBuild(deps({ flags: mkFlags({ out: 'out', cwd: '.' }) }))
    expect(tmp.exists('out/metadata.json')).toBe(true)
  })

  it('writes the shell into a dist/ tree beside the project', async () => {
    const out = join(`${tmp.path}-dist`, 'shell')
    try {
      await runBuild(deps({ flags: mkFlags({ out }) }))
      expect(existsSync(join(out, 'metadata.json'))).toBe(true)
    } finally {
      rmSync(`${tmp.path}-dist`, { recursive: true, force: true })
    }
  })

  it('accepts an existing empty --out', async () => {
    tmp.mkdir('out')
    const code = await runBuild(deps({ flags: mkFlags({ out: 'out' }) }))
    expect(code).toBe(0)
  })

  it('replaces an earlier shell in --out, dropping its stale tarball', async () => {
    tmp.write('out/metadata.json', '{ "generatedBy": "@hyperfrontend/features" }')
    tmp.write('out/clock-shell-0.9.0.tgz', 'stale')
    await runBuild(deps({ flags: mkFlags({ out: 'out' }) }))
    expect(tmp.exists('out/clock-shell-0.9.0.tgz')).toBe(false)
  })

  it('refuses an --out holding files it did not write', async () => {
    tmp.write('src/app.ts', 'export {}')
    const code = await runBuild(deps({ flags: mkFlags({ out: 'src' }) }))
    expect(code).toBe(1)
  })

  it('tells the consumer to pick a new or empty directory for a foreign --out', async () => {
    tmp.write('src/app.ts', 'export {}')
    const err = createCapturedOutput()
    await runBuild(deps({ flags: mkFlags({ out: 'src' }), stderr: err }))
    expect(err.text()).toBe(
      `build: --out "${tmp.resolve('src')}" holds files hf build did not write. Point --out at a new or empty directory, or remove it first.\n`
    )
  })

  it('refuses a foreign --out before building anything', async () => {
    tmp.write('src/app.ts', 'export {}')
    const runBuilder = jest.fn()
    await runBuild(deps({ flags: mkFlags({ out: 'src' }), runBuilder }))
    expect(runBuilder).not.toHaveBeenCalled()
  })

  it('refuses the project directory as --out', async () => {
    const code = await runBuild(deps({ flags: mkFlags({ out: '.' }) }))
    expect(code).toBe(1)
  })

  it('refuses a parent of the project as --out', async () => {
    const err = createCapturedOutput()
    await runBuild(deps({ flags: mkFlags({ out: '..' }), stderr: err }))
    expect(err.text()).toEqual(expect.stringContaining('contains the project itself'))
  })

  it('reports an unusable --out under --dry-run', async () => {
    const code = await runBuild(deps({ flags: mkFlags({ out: '.', dryRun: true }) }))
    expect(code).toBe(1)
  })

  it('refuses to replace an --out that gained foreign files during the build', async () => {
    const runBuilder = jest.fn(() => {
      tmp.write('out/notes.txt', 'mine')
      return Promise.resolve()
    })
    await runBuild(deps({ flags: mkFlags({ out: 'out' }), runBuilder }))
    expect(tmp.read('out/notes.txt')).toBe('mine')
  })

  it('publishes the staged README beside the built package', async () => {
    await runBuild(deps({}))
    expect(tmp.read('dist/clock-shell/README.md')).toContain('# clock-shell')
  })

  it('publishes the staged metadata beside the built package', async () => {
    await runBuild(deps({}))
    expect(tmp.read('dist/clock-shell/metadata.json')).toContain('"protocol": "v4"')
  })

  it('lists metadata.json in the built manifest files array so npm pack ships it', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'package.json'), '{ "name": "clock-shell", "files": ["**/index.*"] }')
      return Promise.resolve()
    })
    await runBuild(deps({ runBuilder }))
    expect(parse(tmp.read('dist/clock-shell/package.json'))).toEqual(expect.objectContaining({ files: ['**/index.*', 'metadata.json'] }))
  })

  it('leaves a built manifest without a files array untouched', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'package.json'), '{ "name": "clock-shell" }')
      return Promise.resolve()
    })
    await runBuild(deps({ runBuilder }))
    expect(parse(tmp.read('dist/clock-shell/package.json'))).not.toHaveProperty('files')
  })

  it('normalizes declaration-map sources before packing', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'index.d.ts.map'), '{"version":3,"sources":["../../.hf-shell-clock-123/src/index.ts"]}')
      return Promise.resolve()
    })
    await runBuild(deps({ runBuilder }))
    expect(tmp.read('dist/clock-shell/index.d.ts.map')).toBe('{"version":3,"sources":["clock/src/index.ts"]}')
  })

  it('notes a malformed declaration map on stderr without failing the build', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'index.d.ts.map'), 'not json')
      return Promise.resolve()
    })
    const err = createCapturedOutput()
    const code = await runBuild(deps({ runBuilder, stderr: err }))
    expect({ code, note: err.text() }).toEqual({ code: 0, note: expect.stringContaining('Skipping malformed declaration map') })
  })

  it('defaults the output to a per-shell directory under dist', async () => {
    await runBuild(deps({}))
    expect(tmp.exists('dist/clock-shell/metadata.json')).toBe(true)
  })

  it('accepts an absolute --out path', async () => {
    await runBuild(deps({ flags: mkFlags({ out: tmp.resolve('abs-out') }) }))
    expect(tmp.exists('abs-out/metadata.json')).toBe(true)
  })

  it('removes the staging dir once the shell is delivered', async () => {
    await runBuild(deps({}))
    expect(tmp.exists(`.hf-shell-clock-${process.pid}`)).toBe(false)
  })

  it('surfaces a resolution error', async () => {
    const err = createCapturedOutput()
    const code = await runBuild(deps({ resolveConfig: () => Promise.reject(new Error('bad config')), stderr: err }))
    expect(code).toBe(1)
  })

  it('surfaces a non-Error rejection', async () => {
    const err = createCapturedOutput()
    const code = await runBuild(deps({ resolveConfig: () => Promise.reject('boom'), stderr: err }))
    expect(code).toBe(1)
  })

  it('resolves real config files when no resolver is injected', async () => {
    tmp.write('clock.contract.json', '{ "emitted": [], "accepted": [] }')
    tmp.write('feature.config.json', '{ "name": "clock", "version": "1.0.0", "contract": "./clock.contract.json", "protocol": "v4" }')
    const code = await runBuild({
      flags: mkFlags({}),
      cwd: tmp.path,
      stdout: createCapturedOutput(),
      stderr: createCapturedOutput(),
      runBuilder: jest.fn(),
      packTarball: () => 'clock.tgz',
    })
    expect(code).toBe(0)
  })

  const runWithoutRunners = async (): Promise<void> => {
    // why: the module mocks persist across tests, so each run starts from an empty call log
    mockBuild.mockClear()
    mockExecFileSync.mockClear()
    mockBuild.mockResolvedValue({} as Awaited<ReturnType<typeof build>>)
    mockExecFileSync.mockReturnValue('clock-shell-1.0.0.tgz\n')
    await runBuild({
      flags: mkFlags({}),
      cwd: tmp.path,
      stdout: createCapturedOutput(),
      stderr: createCapturedOutput(),
      resolveConfig: () => Promise.resolve(bundle('v4')),
    })
  }

  it('drives the builder when no builder runner is injected', async () => {
    await runWithoutRunners()
    expect(mockBuild).toHaveBeenCalledWith(
      expect.objectContaining({ esm: {}, cjs: {}, outputPath: expect.stringContaining('.hf-shell-clock-') })
    )
  })

  it('packs with npm when no pack runner is injected', async () => {
    await runWithoutRunners()
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'npm',
      ['pack'],
      expect.objectContaining({ cwd: expect.stringContaining('.hf-shell-clock-') })
    )
  })
})
