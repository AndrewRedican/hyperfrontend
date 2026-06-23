import type { BuildConfig, BuildResult, FormatOutputs } from '../models'
import { PassThrough } from 'node:stream'
import { readJsonFile } from '@hyperfrontend/project-scope/core'
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
  const actual = jest.requireActual('@hyperfrontend/project-scope/core')
  return { ...actual, readJsonFile: jest.fn() }
})

const drain = (stream: PassThrough): string => {
  const chunks: Buffer[] = []
  let buf: Buffer | null
  while ((buf = <Buffer | null>stream.read()) !== null) chunks.push(buf)
  return Buffer.concat(chunks).toString('utf8')
}

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
  ;(<jest.Mock>build).mockReset().mockResolvedValue(EMPTY_RESULT)
  ;(<jest.Mock>readJsonFile).mockReset().mockReturnValue(baseConfig())
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

  it('captures --help and -h interchangeably', () => {
    expect(parseHfBuildArgs(['--help'])).toEqual({ verbose: false, help: true })
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
    const stderr = new PassThrough()
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(code).toBe(HF_BUILD_EXIT_OK)
    expect(drain(stderr)).toBe('')
  })

  it('reads the default config from <cwd>/builder.config.json', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(readJsonFile).toHaveBeenCalledWith(`/repo/${HF_BUILD_DEFAULT_CONFIG_NAME}`)
  })

  it('honors --config to override the config file path', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: ['--config', '/abs/custom.json'], cwd: '/repo', stderr })
    expect(readJsonFile).toHaveBeenCalledWith('/abs/custom.json')
  })

  it('honors --cwd when resolving the default config path', async () => {
    const stderr = new PassThrough()
    await runHfBuild({ argv: ['--cwd', '/elsewhere'], cwd: '/repo', stderr })
    expect(readJsonFile).toHaveBeenCalledWith(`/elsewhere/${HF_BUILD_DEFAULT_CONFIG_NAME}`)
  })

  it('forwards the parsed config to build()', async () => {
    const stderr = new PassThrough()
    const config = baseConfig()
    ;(<jest.Mock>readJsonFile).mockReturnValueOnce(config)
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(build).toHaveBeenCalledWith(config)
  })

  it('forces config.verbose=true when --verbose is supplied', async () => {
    const stderr = new PassThrough()
    ;(<jest.Mock>readJsonFile).mockReturnValueOnce({ ...baseConfig(), verbose: false })
    await runHfBuild({ argv: ['--verbose'], cwd: '/repo', stderr })
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ verbose: true }))
  })

  it('leaves config.verbose untouched when --verbose is omitted', async () => {
    const stderr = new PassThrough()
    const config = { ...baseConfig(), verbose: false as const }
    ;(<jest.Mock>readJsonFile).mockReturnValueOnce(config)
    await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(build).toHaveBeenCalledWith(config)
  })

  it('prints --help to stdout and returns 0 without invoking build', async () => {
    const stderr = new PassThrough()
    const stdout = new PassThrough()
    const code = await runHfBuild({ argv: ['--help'], cwd: '/repo', stderr, stdout })
    expect(code).toBe(HF_BUILD_EXIT_OK)
    expect(drain(stdout)).toContain('Usage: hf-build')
    expect(drain(stderr)).toBe('')
    expect(readJsonFile).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
  })

  it('falls back to stderr when no stdout is supplied for --help', async () => {
    const stderr = new PassThrough()
    const code = await runHfBuild({ argv: ['-h'], cwd: '/repo', stderr })
    expect(code).toBe(HF_BUILD_EXIT_OK)
    expect(drain(stderr)).toContain('Usage: hf-build')
  })

  it('returns 1 and echoes the message when argv parsing fails', async () => {
    const stderr = new PassThrough()
    const code = await runHfBuild({ argv: ['--bogus'], cwd: '/repo', stderr })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
    expect(drain(stderr)).toBe('Unknown argument: --bogus\n')
    expect(readJsonFile).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
  })

  it('returns 1 and echoes the message when config loading throws an Error', async () => {
    const stderr = new PassThrough()
    ;(<jest.Mock>readJsonFile).mockImplementationOnce(() => {
      throw new Error('Config file not found: /repo/builder.config.json')
    })
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
    expect(drain(stderr)).toBe('Config file not found: /repo/builder.config.json\n')
    expect(build).not.toHaveBeenCalled()
  })

  it('stringifies non-Error throws from config loading before writing them', async () => {
    const stderr = new PassThrough()
    ;(<jest.Mock>readJsonFile).mockImplementationOnce(() => {
      throw 'plain string failure'
    })
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
    expect(drain(stderr)).toBe('plain string failure\n')
  })

  it('returns 1 and echoes the message when build() rejects with an Error', async () => {
    const stderr = new PassThrough()
    ;(<jest.Mock>build).mockRejectedValueOnce(new Error('rollup blew up'))
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
    expect(drain(stderr)).toBe('rollup blew up\n')
  })

  it('stringifies non-Error rejections from build() before writing them', async () => {
    const stderr = new PassThrough()
    ;(<jest.Mock>build).mockRejectedValueOnce('opaque failure')
    const code = await runHfBuild({ argv: [], cwd: '/repo', stderr })
    expect(code).toBe(HF_BUILD_EXIT_ERROR)
    expect(drain(stderr)).toBe('opaque failure\n')
  })

  it('uses injected readConfig and runBuild when provided', async () => {
    const stderr = new PassThrough()
    const injectedConfig = baseConfig()
    const readConfig = jest.fn().mockReturnValue(injectedConfig)
    const runBuild = jest.fn().mockResolvedValue(EMPTY_RESULT)
    const code = await runHfBuild({
      argv: ['--config', '/abs/x.json'],
      cwd: '/repo',
      stderr,
      readConfig,
      runBuild,
    })
    expect(code).toBe(HF_BUILD_EXIT_OK)
    expect(readConfig).toHaveBeenCalledWith('/abs/x.json')
    expect(runBuild).toHaveBeenCalledWith(injectedConfig)
    expect(readJsonFile).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
  })

  it('exposes runHfBuild as the default export so the bootstrap footer can dispatch', () => {
    expect(runHfBuildDefault).toBe(runHfBuild)
  })
})
