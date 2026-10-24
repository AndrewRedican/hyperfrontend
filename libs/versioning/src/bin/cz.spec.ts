import type { LoadCommitConfigOptions, LoadedCommitConfig } from '../commits/author/config-loader/load'
import type { AuthorSession, CreateAuthorSessionOptions } from '../commits/author/session/create-session'
import type { RunCzOptions } from './cz'
import { PassThrough } from 'node:stream'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readAll } from '@hyperfrontend/testing/process'
import { createTestConfig } from '../commits/author/__test-utils__/base-config'
import { EXIT_COMMITTED, EXIT_ERROR, EXIT_SIGINT, outcomeToExit, parseCzArgs, runCz } from './cz'

describe('parseCzArgs', () => {
  it('returns an empty object when argv is empty', () => {
    expect(parseCzArgs([])).toEqual({})
  })

  it('captures --config', () => {
    expect(parseCzArgs(['--config', './commit.config.cjs'])).toEqual({ configPath: './commit.config.cjs' })
  })

  it('captures --cwd', () => {
    expect(parseCzArgs(['--cwd', '/repo'])).toEqual({ cwdOverride: '/repo' })
  })

  it('captures --config followed by --cwd', () => {
    expect(parseCzArgs(['--config', 'a.cjs', '--cwd', '/b'])).toEqual({ configPath: 'a.cjs', cwdOverride: '/b' })
  })

  it('captures --cwd followed by --config', () => {
    expect(parseCzArgs(['--cwd', '/b', '--config', 'a.cjs'])).toEqual({ configPath: 'a.cjs', cwdOverride: '/b' })
  })

  it('throws when --config is missing its value', () => {
    expect(() => parseCzArgs(['--config'])).toThrow(/--config requires a path/)
  })

  it('throws when --cwd is missing its value', () => {
    expect(() => parseCzArgs(['--cwd'])).toThrow(/--cwd requires a path/)
  })

  it('throws on unknown flags', () => {
    expect(() => parseCzArgs(['--bogus'])).toThrow(/Unknown argument: --bogus/)
  })
})

describe('outcomeToExit', () => {
  it('returns 0 for a committed outcome', () => {
    expect(outcomeToExit({ status: 'committed', message: 'feat: x' }, new PassThrough())).toBe(EXIT_COMMITTED)
  })

  it('writes nothing to stderr for a committed outcome', () => {
    const stderr = new PassThrough()
    outcomeToExit({ status: 'committed', message: 'feat: x' }, stderr)
    expect(readAll(stderr)).toBe('')
  })

  it('returns 130 for a clean cancellation', () => {
    expect(outcomeToExit({ status: 'cancelled' }, new PassThrough())).toBe(EXIT_SIGINT)
  })

  it('writes nothing to stderr for a clean cancellation', () => {
    const stderr = new PassThrough()
    outcomeToExit({ status: 'cancelled' }, stderr)
    expect(readAll(stderr)).toBe('')
  })

  it('returns 1 for an error cancellation', () => {
    expect(outcomeToExit({ status: 'cancelled', error: createError('boom') }, new PassThrough())).toBe(EXIT_ERROR)
  })

  it('writes the error message to stderr for an error cancellation', () => {
    const stderr = new PassThrough()
    outcomeToExit({ status: 'cancelled', error: createError('boom') }, stderr)
    expect(readAll(stderr)).toBe('boom\n')
  })
})

describe('runCz', () => {
  /**
   * Builds a trivial `loadCommitConfig` stand-in that returns an empty config.
   *
   * @param capture - Object the stub writes the received options to
   * @param capture.options - Slot for the options `loadCommitConfig` is called with
   * @returns Async stand-in that records its call and returns an empty config
   */
  function stubLoad(capture: { options?: LoadCommitConfigOptions }): (options: LoadCommitConfigOptions) => Promise<LoadedCommitConfig> {
    return async (options) => {
      capture.options = options
      return { config: {} }
    }
  }

  /**
   * Builds a trivial `createAuthorSession` stand-in that records the options.
   *
   * @param capture - Object the stub writes the received options to
   * @param capture.options - Slot for the options `createAuthorSession` is called with
   * @returns Sync stand-in returning a minimal `AuthorSession` shape
   */
  function stubCreateSession(capture: { options?: CreateAuthorSessionOptions }): (options?: CreateAuthorSessionOptions) => AuthorSession {
    return (options = {}) => {
      capture.options = options
      return { steps: [], config: createTestConfig() }
    }
  }

  /**
   * Runs `runCz` against a buffered stderr and pairs the exit code with everything it wrote.
   *
   * @param options - Every `runCz` option except the stream, which the helper supplies
   * @returns Exit code of the run and the drained stderr text
   */
  async function runCzCapturing(options: Omit<RunCzOptions, 'stderr'>): Promise<{ code: number; stderr: string }> {
    const stderr = new PassThrough()
    const code = await runCz({ ...options, stderr })
    return { code, stderr: readAll(stderr) }
  }

  it('returns 0 when the session commits', async () => {
    const { code } = await runCzCapturing({
      argv: ['--cwd', '/repo', '--config', './cfg.cjs'],
      cwd: '/other',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'feat: x' }),
    })

    expect(code).toBe(EXIT_COMMITTED)
  })

  it('forwards --cwd and --config to loadCommitConfig', async () => {
    const load = { options: undefined as LoadCommitConfigOptions | undefined }

    await runCzCapturing({
      argv: ['--cwd', '/repo', '--config', './cfg.cjs'],
      cwd: '/other',
      loadConfig: stubLoad(load),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'feat: x' }),
    })

    expect(load.options).toEqual({ cwd: '/repo', overridePath: './cfg.cjs' })
  })

  it('passes the resolved cwd to createAuthorSession', async () => {
    const create = { options: undefined as CreateAuthorSessionOptions | undefined }

    await runCzCapturing({
      argv: ['--cwd', '/repo', '--config', './cfg.cjs'],
      cwd: '/other',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession(create),
      runSession: async () => ({ status: 'committed', message: 'feat: x' }),
    })

    expect(create.options?.config?.cwd).toBe('/repo')
  })

  it('writes nothing to stderr when the session commits', async () => {
    const { stderr } = await runCzCapturing({
      argv: ['--cwd', '/repo', '--config', './cfg.cjs'],
      cwd: '/other',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'feat: x' }),
    })

    expect(stderr).toBe('')
  })

  it('returns 130 when the session is cancelled cleanly', async () => {
    const { code } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'cancelled' }),
    })

    expect(code).toBe(EXIT_SIGINT)
  })

  it('writes nothing to stderr when the session is cancelled cleanly', async () => {
    const { stderr } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'cancelled' }),
    })

    expect(stderr).toBe('')
  })

  it('returns 1 for an error cancellation', async () => {
    const { code } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'cancelled', error: createError('No staged changes') }),
    })

    expect(code).toBe(EXIT_ERROR)
  })

  it('echoes the error message to stderr for an error cancellation', async () => {
    const { stderr } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'cancelled', error: createError('No staged changes') }),
    })

    expect(stderr).toBe('No staged changes\n')
  })

  it('returns 1 when argv parsing fails', async () => {
    const { code } = await runCzCapturing({
      argv: ['--bogus'],
      cwd: '/repo',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(code).toBe(EXIT_ERROR)
  })

  it('writes the argv error to stderr when argv parsing fails', async () => {
    const { stderr } = await runCzCapturing({
      argv: ['--bogus'],
      cwd: '/repo',
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(stderr).toBe('Unknown argument: --bogus\n')
  })

  it('returns 1 when config loading fails', async () => {
    const { code } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: async () => {
        throw createError('Config file not found: /nope')
      },
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(code).toBe(EXIT_ERROR)
  })

  it('echoes the thrown error to stderr when config loading fails', async () => {
    const { stderr } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: async () => {
        throw createError('Config file not found: /nope')
      },
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(stderr).toBe('Config file not found: /nope\n')
  })

  it('returns 1 when loadConfig throws a non-Error', async () => {
    const { code } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: async () => {
        throw 'plain string failure'
      },
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(code).toBe(EXIT_ERROR)
  })

  it('stringifies non-Error throws before writing them to stderr', async () => {
    const { stderr } = await runCzCapturing({
      argv: [],
      cwd: '/repo',
      loadConfig: async () => {
        throw 'plain string failure'
      },
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(stderr).toBe('plain string failure\n')
  })

  it('falls back to options.cwd when --cwd is not provided', async () => {
    const stderr = new PassThrough()
    const load = { options: undefined as LoadCommitConfigOptions | undefined }

    await runCz({
      argv: [],
      cwd: '/fallback',
      stderr,
      loadConfig: stubLoad(load),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(load.options?.cwd).toBe('/fallback')
  })
})
