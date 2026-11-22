import type { ReleaseManifest } from '@hyperfrontend/server/manifest'
import type { CliFlags } from '../args'
import type { ResolvedBuildBundle } from '../config/resolve'
import type { RunBuildOptions } from './build'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from '@hyperfrontend/builder'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { shimCommand } from '@hyperfrontend/project-scope/core/process'
import { parseReleaseManifest, verifyRelease } from '@hyperfrontend/server/manifest'
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

  const withServeConfig = (permissions: readonly string[], serve: unknown): Promise<ResolvedBuildBundle> => {
    tmp.write(join('public', 'hf-serve.config.json'), JSON.stringify(serve))
    const resolved = bundle('v4')
    return Promise.resolve({
      ...resolved,
      config: { ...resolved.config, permissions: [...permissions] },
      sourcePath: tmp.resolve('feature.config.json'),
    })
  }

  it('warns on stderr when the serve config isolates an origin the feature opens windows onto', async () => {
    const err = createCapturedOutput()
    await runBuild(deps({ resolveConfig: () => withServeConfig([], { isolation: 'require-corp' }), stderr: err }))
    expect(err.text()).toEqual(expect.stringContaining('Warning: this feature composes "popup" and "standalone"'))
  })

  it('warns on stderr when the serve config disables a permission the feature declares', async () => {
    const err = createCapturedOutput()
    await runBuild(deps({ resolveConfig: () => withServeConfig(['camera'], { permissionsPolicy: { camera: [] } }), stderr: err }))
    expect(err.text()).toEqual(expect.stringContaining('Warning: this feature declares the "camera" permission'))
  })

  it('prints both serve config warnings when the two disagreements meet', async () => {
    const err = createCapturedOutput()
    const serve = { isolation: 'require-corp', permissionsPolicy: { camera: [] } }
    await runBuild(deps({ resolveConfig: () => withServeConfig(['camera'], serve), stderr: err }))
    expect(err.text().match(/^Warning: this feature (composes|declares)/gm)).toEqual([
      'Warning: this feature composes',
      'Warning: this feature declares',
    ])
  })

  it.each([
    ['headers that are no array', { headers: { 'X-Test': 'on' } }],
    ['a rule that is no object', { headers: [null] }],
    ['a rule without a headers record', { headers: [{}] }],
  ])('builds a feature that declares isolation beside a serve config with %s', async (_label: string, serve: unknown) => {
    const err = createCapturedOutput()
    const resolveConfig = async (): Promise<ResolvedBuildBundle> => {
      const resolved = await withServeConfig(['camera'], serve)
      return { ...resolved, config: { ...resolved.config, isolation: 'require-corp' } }
    }
    const code = await runBuild(deps({ resolveConfig, stderr: err }))
    expect({ code, stderr: err.text() }).toEqual({ code: 0, stderr: '' })
  })

  it.each([
    ['headers that are no array', { headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }],
    ['a rule that is no object', { headers: [null] }],
    ['a rule without a headers record', { headers: [{}] }],
  ])('builds a feature that declares no isolation beside a serve config with %s', async (_label: string, serve: unknown) => {
    const err = createCapturedOutput()
    const code = await runBuild(deps({ resolveConfig: () => withServeConfig([], serve), stderr: err }))
    expect({ code, stderr: err.text() }).toEqual({ code: 0, stderr: '' })
  })

  it('still builds when the serve config earns a warning', async () => {
    const code = await runBuild(deps({ resolveConfig: () => withServeConfig(['camera'], { permissionsPolicy: { camera: [] } }) }))
    expect(code).toBe(0)
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

  it('lists metadata.json and hf-release.json in the built manifest files array so npm pack ships them', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'package.json'), '{ "name": "clock-shell", "files": ["**/index.*"] }')
      return Promise.resolve()
    })
    await runBuild(deps({ runBuilder }))
    expect(parse(tmp.read('dist/clock-shell/package.json'))).toEqual(
      expect.objectContaining({ files: ['**/index.*', 'metadata.json', 'hf-release.json'] })
    )
  })

  it('leaves a built manifest without a files array untouched', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'package.json'), '{ "name": "clock-shell" }')
      return Promise.resolve()
    })
    await runBuild(deps({ runBuilder }))
    expect(parse(tmp.read('dist/clock-shell/package.json'))).not.toHaveProperty('files')
  })

  const releaseManifest = (out = join('dist', 'clock-shell')): ReleaseManifest =>
    parseReleaseManifest(tmp.read(join(out, 'hf-release.json')), tmp.resolve(join(out, 'hf-release.json')))

  it('writes a release manifest beside the metadata', async () => {
    await runBuild(deps({}))
    expect(tmp.exists(join('dist', 'clock-shell', 'hf-release.json'))).toBe(true)
  })

  it('describes exactly the files of the delivered shell in the release manifest', async () => {
    await runBuild(deps({}))
    expect(verifyRelease(tmp.resolve(join('dist', 'clock-shell')), releaseManifest())).toEqual([])
  })

  it('names the shell package in the release manifest', async () => {
    await runBuild(deps({}))
    expect(releaseManifest().name).toBe('clock-shell')
  })

  it('stamps the canonical version into the release manifest', async () => {
    const resolved = bundle('v4')
    await runBuild(deps({ resolveConfig: () => Promise.resolve({ ...resolved, config: { ...resolved.config, version: 'v1.2.0' } }) }))
    expect(releaseManifest().version).toBe('1.2.0')
  })

  it('hashes the package manifest as it is packed', async () => {
    let packed = Buffer.alloc(0)
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'package.json'), '{ "name": "clock-shell", "files": ["**/index.*"] }')
      return Promise.resolve()
    })
    const packTarball = (packageDir: string): string => {
      packed = readFileSync(join(packageDir, 'package.json'))
      return 'clock-shell-1.0.0.tgz'
    }
    await runBuild(deps({ runBuilder, packTarball }))
    expect(releaseManifest().files.filter((file) => file.path === 'package.json')).toEqual([
      { path: 'package.json', size: packed.length, sha256: createHash('sha256').update(packed).digest('hex') },
    ])
  })

  it('leaves the release manifest out of its own list', async () => {
    const runBuilder = jest.fn((input: { outputPath: string }) => {
      writeFileSync(join(input.outputPath, 'hf-release.json'), 'left by an earlier pass')
      return Promise.resolve()
    })
    await runBuild(deps({ runBuilder }))
    expect(releaseManifest().files.map((file) => file.path)).toEqual(['README.md', 'metadata.json'])
  })

  it('writes the release manifest before packing', async () => {
    let present = false
    const packTarball = (packageDir: string): string => {
      present = existsSync(join(packageDir, 'hf-release.json'))
      return 'clock-shell-1.0.0.tgz'
    }
    await runBuild(deps({ packTarball }))
    expect(present).toBe(true)
  })

  it('rebuilds an unchanged feature to the same release manifest', async () => {
    await runBuild(deps({ flags: mkFlags({ out: 'first' }) }))
    await runBuild(deps({ flags: mkFlags({ out: 'second' }) }))
    expect(tmp.read(join('second', 'hf-release.json'))).toBe(tmp.read(join('first', 'hf-release.json')))
  })

  it('fails the build on a feature name the release manifest cannot hold', async () => {
    const err = createCapturedOutput()
    const resolved = bundle('v4')
    const resolveConfig = (): Promise<ResolvedBuildBundle> =>
      Promise.resolve({ ...resolved, config: { ...resolved.config, name: 'wall clock' } })
    const code = await runBuild(deps({ resolveConfig, stderr: err }))
    expect({ code, stderr: err.text() }).toEqual({
      code: 1,
      stderr: expect.stringContaining('name must be a non-empty string with no whitespace, control character or U+FFFD.'),
    })
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

  const runUnreleasable = async (
    field: string,
    flags: Partial<CliFlags>
  ): Promise<{ code: number; stdout: string; stderr: string; builderRuns: number }> => {
    const stdout = createCapturedOutput()
    const stderr = createCapturedOutput()
    const runBuilder = jest.fn()
    tmp.write('clock.contract.json', '{ "emitted": [], "accepted": [] }')
    tmp.write(
      'feature.config.json',
      stringify({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', protocol: 'v4', ...parse(field) })
    )
    const code = await runBuild({ flags: mkFlags(flags), cwd: tmp.path, stdout, stderr, runBuilder, packTarball: () => 'clock.tgz' })
    return { code, stdout: stdout.text(), stderr: stderr.text(), builderRuns: runBuilder.mock.calls.length }
  }

  it.each([
    ['a feature name with whitespace', '{ "name": "wall clock" }'],
    ['a version with a leading zero in a numeric prerelease identifier', '{ "version": "1.2.3-01" }'],
  ])('refuses %s before the builder runs', async (_label, field) => {
    const { code, builderRuns } = await runUnreleasable(field, {})
    expect({ code, builderRuns }).toEqual({ code: 1, builderRuns: 0 })
  })

  it.each([
    ['name', '{ "name": "wall clock" }'],
    ['version', '{ "version": "1.2.3-01" }'],
  ])('names the config field "%s" when it refuses it', async (key, field) => {
    const { stderr } = await runUnreleasable(field, {})
    expect(stderr).toContain(`Invalid config: "${key}" `)
  })

  it.each([
    ['name', '{ "name": "wall clock" }'],
    ['version', '{ "version": "1.2.3-01" }'],
  ])('names no staging path when it refuses the config "%s"', async (_key, field) => {
    const { stderr } = await runUnreleasable(field, {})
    expect(stderr).not.toContain('.hf-shell-')
  })

  it.each([
    ['name', '{ "name": "wall clock" }'],
    ['version', '{ "version": "1.2.3-01" }'],
  ])('reports the same refusal of the config "%s" on a dry run', async (key, field) => {
    const { code, stdout, stderr } = await runUnreleasable(field, { dryRun: true })
    expect({ code, stdout, stderr }).toEqual({ code: 1, stdout: '', stderr: expect.stringContaining(`Invalid config: "${key}" `) })
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
    const npm = shimCommand('npm', ['pack'])
    expect(mockExecFileSync).toHaveBeenCalledWith(
      npm.file,
      npm.args,
      expect.objectContaining({ cwd: expect.stringContaining('.hf-shell-clock-'), shell: npm.shell })
    )
  })

  it('packs with npm as one shell command line on Windows', async () => {
    const platform = jest.replaceProperty(process, 'platform', 'win32')
    try {
      await runWithoutRunners()
    } finally {
      platform.restore()
    }
    expect(mockExecFileSync).toHaveBeenCalledWith('npm pack', [], expect.objectContaining({ shell: true }))
  })
})
