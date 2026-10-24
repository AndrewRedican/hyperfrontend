import type { Mock } from '@hyperfrontend/testing'
import type { BuildConfig, BuildResult, FormatOutputs } from '../models'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { beforeEach } from 'node:test'
import { readJsonFile } from '@hyperfrontend/project-scope/core'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { readAll } from '@hyperfrontend/testing/process'
import { build } from '../build'
import runHfBuildDefault, {
  HF_BUILD_DEFAULT_CONFIG_NAME,
  HF_BUILD_EXIT_ERROR,
  HF_BUILD_EXIT_OK,
  parseHfBuildArgs,
  runHfBuild,
} from './hf-build'
jest.mock('../build', () => ({ build: jest.fn() }))
jest.mock('@hyperfrontend/project-scope/core', () => {
  const actual = jest.requireActual<typeof import('@hyperfrontend/project-scope/core')>('@hyperfrontend/project-scope/core')
  return { ...actual, readJsonFile: jest.fn() }
})

const EMPTY_FORMATS: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }
const EMPTY_RESULT: BuildResult = {
  success: true,
  formatCounts: { esm: 0, cjs: 0, iife: 0, umd: 0 },
  formatOutputs: EMPTY_FORMATS,
  binOutputs: [],
  durationMs: 0,
}

const baseConfig = (): BuildConfig => ({ projectRoot: '/abs/repo/libs/foo', workspaceRoot: '/abs/repo' })

beforeEach(() => {
  ;(build as Mock).mockReset().mockResolvedValue(EMPTY_RESULT)
  ;(readJsonFile as Mock).mockReset().mockReturnValue(baseConfig())
})

describe('parseHfBuildArgs', () => {
  it('returns verbose=false and help=false for an empty argv', () => {
    expect(parseHfBuildArgs([])).toEqual({ verbose: false, help: false })
  })

  it('captures --config', () => {
    expect(parseHfBuildArgs(['--config', './custom.json'])).toEqual({
      configPath: './custom.json',
      verbose: false,
      help: false,
    })
  })

  it('captures --cwd', () => {
    expect(parseHfBuildArgs(['--cwd', '/repo'])).toEqual({
      cwdOverride: '/repo',
      verbose: false,
      help: false,
    })
  })

  it('captures --verbose as a boolean flag', () => {
    expect(parseHfBuildArgs(['--verbose'])).toEqual({ verbose: true, help: false })
  })

  it('captures --help as a boolean flag', () => {
    expect(parseHfBuildArgs(['--help'])).toEqual({ verbose: false, help: true })
  })

  it('captures -h as the short form of --help', () => {
    expect(parseHfBuildArgs(['-h'])).toEqual({ verbose: false, help: true })
  })

  it('captures all flags together regardless of order', () => {
    expect(parseHfBuildArgs(['--cwd', '/r', '--config', 'a.json', '--verbose'])).toEqual({
      configPath: 'a.json',
      cwdOverride: '/r',
      verbose: true,
      help: false,
    })
  })

  it('throws when --config is missing its value', () => {
    expect(() => parseHfBuildArgs(['--config'])).toThrow(/--config requires a path/)
  })

  it('throws when --cwd is missing its value', () => {
    expect(() => parseHfBuildArgs(['--cwd'])).toThrow(/--cwd requires a path/)
  })

  it('throws on unknown flags', () => {
    expect(() => parseHfBuildArgs(['--bogus'])).toThrow(/Unknown argument: --bogus/)
  })
})

describe('runHfBuild', () => {
  it('returns 0 when the build resolves', async () => {
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_OK)
  })

  it('writes nothing to stderr when the build resolves', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(readAll(stderr)).toBe('')
  })

  it('reads the default config from <cwd>/builder.config.json', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(readJsonFile).toHaveBeenCalledWith(join('/repo', HF_BUILD_DEFAULT_CONFIG_NAME))
  })

  it('honors --config to override the config file path', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: ['--config', '/abs/custom.json'], cwd: '/repo', stderr })
    expect(readJsonFile).toHaveBeenCalledWith('/abs/custom.json')
  })

  it('honors --cwd when resolving the default config path', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: ['--cwd', '/elsewhere'], cwd: '/repo', stderr })
    expect(readJsonFile).toHaveBeenCalledWith(join('/elsewhere', HF_BUILD_DEFAULT_CONFIG_NAME))
  })

  it('forwards the parsed config to build()', async () => {
    const stderr = new PassThrough()
    const config = baseConfig()
    ;(readJsonFile as Mock).mockReturnValueOnce(config)
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(build).toHaveBeenCalledWith(config)
  })

  it('forces config.verbose=true when --verbose is supplied', async () => {
    const stderr = new PassThrough()
    ;(readJsonFile as Mock).mockReturnValueOnce({ ...baseConfig(), verbose: false })
    await runHfBuild({ argv: ['--verbose'], cwd: '/repo', stderr })
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ verbose: true }))
  })

  it('leaves config.verbose untouched when --verbose is omitted', async () => {
    const stderr = new PassThrough()
    const config = { ...baseConfig(), verbose: false as const }
    ;(readJsonFile as Mock).mockReturnValueOnce(config)
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(build).toHaveBeenCalledWith(config)
  })

  it('returns 0 for --help', async () => {
    const code = await runHfBuild({ argv: ['--help'], cwd: '/repo', stderr: new PassThrough(), stdout: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_OK)
  })

  it('prints the usage text to stdout for --help', async () => {
    const stdout = new PassThrough()
    await runHfBuild({ argv: ['--help'], cwd: '/repo', stderr: new PassThrough(), stdout })
    expect(readAll(stdout)).toContain('Usage: hf-build')
  })

  it('writes nothing to stderr for --help when stdout is supplied', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: ['--help'], cwd: '/repo', stderr, stdout: new PassThrough() })
    expect(readAll(stderr)).toBe('')
  })

  it('reads no config file for --help', async () => {
    await runHfBuild({ argv: ['--help'], cwd: '/repo', stderr: new PassThrough(), stdout: new PassThrough() })
    expect(readJsonFile).not.toHaveBeenCalled()
  })

  it('invokes no build for --help', async () => {
    await runHfBuild({ argv: ['--help'], cwd: '/repo', stderr: new PassThrough(), stdout: new PassThrough() })
    expect(build).not.toHaveBeenCalled()
  })

  it('returns 0 for -h when no stdout is supplied', async () => {
    const code = await runHfBuild({ argv: ['-h'], cwd: '/repo', stderr: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_OK)
  })

  it('falls back to stderr for the usage text when no stdout is supplied', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: ['-h'], cwd: '/repo', stderr })
    expect(readAll(stderr)).toContain('Usage: hf-build')
  })

  it('returns 1 when argv parsing fails', async () => {
    const code = await runHfBuild({ argv: ['--bogus'], cwd: '/repo', stderr: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
  })

  it('echoes the parse error to stderr when argv parsing fails', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: ['--bogus'], cwd: '/repo', stderr })
    expect(readAll(stderr)).toBe('Unknown argument: --bogus\n')
  })

  it('reads no config file when argv parsing fails', async () => {
    await runHfBuild({ argv: ['--bogus'], cwd: '/repo', stderr: new PassThrough() })
    expect(readJsonFile).not.toHaveBeenCalled()
  })

  it('invokes no build when argv parsing fails', async () => {
    await runHfBuild({ argv: ['--bogus'], cwd: '/repo', stderr: new PassThrough() })
    expect(build).not.toHaveBeenCalled()
  })

  it('returns 1 when config loading throws an Error', async () => {
    ;(readJsonFile as Mock).mockImplementationOnce(() => {
      throw new Error('Config file not found: /repo/builder.config.json')
    })
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
  })

  it('echoes the message to stderr when config loading throws an Error', async () => {
    const stderr = new PassThrough()
    ;(readJsonFile as Mock).mockImplementationOnce(() => {
      throw new Error('Config file not found: /repo/builder.config.json')
    })
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(readAll(stderr)).toBe('Config file not found: /repo/builder.config.json\n')
  })

  it('invokes no build when config loading throws', async () => {
    ;(readJsonFile as Mock).mockImplementationOnce(() => {
      throw new Error('Config file not found: /repo/builder.config.json')
    })
    await runHfBuild({ argv: [], cwd: '/repo', stderr: new PassThrough() })
    expect(build).not.toHaveBeenCalled()
  })

  it('returns 1 when config loading throws a non-Error', async () => {
    ;(readJsonFile as Mock).mockImplementationOnce(() => {
      throw 'plain string failure'
    })
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
  })

  it('stringifies non-Error throws from config loading before writing them', async () => {
    const stderr = new PassThrough()
    ;(readJsonFile as Mock).mockImplementationOnce(() => {
      throw 'plain string failure'
    })
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(readAll(stderr)).toBe('plain string failure\n')
  })

  it('returns 1 when build() rejects with an Error', async () => {
    ;(build as Mock).mockRejectedValueOnce(new Error('rollup blew up'))
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
  })

  it('echoes the message to stderr when build() rejects with an Error', async () => {
    const stderr = new PassThrough()
    ;(build as Mock).mockRejectedValueOnce(new Error('rollup blew up'))
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(readAll(stderr)).toBe('rollup blew up\n')
  })

  it('returns 1 when build() rejects with a non-Error', async () => {
    ;(build as Mock).mockRejectedValueOnce('opaque failure')
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr: new PassThrough() })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
  })

  it('stringifies non-Error rejections from build() before writing them', async () => {
    const stderr = new PassThrough()
    ;(build as Mock).mockRejectedValueOnce('opaque failure')
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(readAll(stderr)).toBe('opaque failure\n')
  })

  const runWithInjected = async (): Promise<{ code: number; readConfig: Mock; runBuild: Mock; injectedConfig: BuildConfig }> => {
    const injectedConfig = baseConfig()
    const readConfig = jest.fn().mockReturnValue(injectedConfig)
    const runBuild = jest.fn().mockResolvedValue(EMPTY_RESULT)
    const code = await runHfBuild({ argv: ['--config', '/abs/x.json'], cwd: '/repo', stderr: new PassThrough(), readConfig, runBuild })
    return { code, readConfig, runBuild, injectedConfig }
  }

  it('returns 0 when the injected readConfig and runBuild succeed', async () => {
    const { code } = await runWithInjected()
    expect(code).toBe(HF_BUILD_EXIT_OK)
  })

  it('reads the config through the injected readConfig', async () => {
    const { readConfig } = await runWithInjected()
    expect(readConfig).toHaveBeenCalledWith('/abs/x.json')
  })

  it('builds through the injected runBuild with the config it read', async () => {
    const { runBuild, injectedConfig } = await runWithInjected()
    expect(runBuild).toHaveBeenCalledWith(injectedConfig)
  })

  it('bypasses the default config reader when readConfig is injected', async () => {
    await runWithInjected()
    expect(readJsonFile).not.toHaveBeenCalled()
  })

  it('bypasses the default build when runBuild is injected', async () => {
    await runWithInjected()
    expect(build).not.toHaveBeenCalled()
  })

  it('exposes runHfBuild as the default export so the bootstrap footer can dispatch', () => {
    expect(runHfBuildDefault).toBe(runHfBuild)
  })
})
