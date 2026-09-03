import type { LoadCommitConfigOptions, LoadedCommitConfig } from '../commits/author/config-loader/load'
import type { AuthorSession, CreateAuthorSessionOptions } from '../commits/author/session/create-session'
import { PassThrough } from 'node:stream'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { EXIT_COMMITTED, EXIT_ERROR, EXIT_SIGINT, outcomeToExit, parseCzArgs, runCz } from './cz'

/**
 * Extracts everything written to the mock stream as a single string.
 *
 * @param stream - Stream whose buffered content should be read
 * @returns Concatenated stream output decoded as UTF-8
 */
function drain(stream: PassThrough): string {
  const chunks: Buffer[] = []
  let buf: Buffer | null
  while ((buf = stream.read() as Buffer | null) !== null) chunks.push(buf)
  return Buffer.concat(chunks).toString('utf8')
}

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

  it('captures both --config and --cwd in either order', () => {
    expect(parseCzArgs(['--config', 'a.cjs', '--cwd', '/b'])).toEqual({ configPath: 'a.cjs', cwdOverride: '/b' })
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
    const stderr = new PassThrough()
    expect(outcomeToExit({ status: 'committed', message: 'feat: x' }, stderr)).toBe(EXIT_COMMITTED)
    expect(drain(stderr)).toBe('')
  })

  it('returns 130 for a clean cancellation', () => {
    const stderr = new PassThrough()
    expect(outcomeToExit({ status: 'cancelled' }, stderr)).toBe(EXIT_SIGINT)
    expect(drain(stderr)).toBe('')
  })

  it('returns 1 and writes the message for an error cancellation', () => {
    const stderr = new PassThrough()
    expect(outcomeToExit({ status: 'cancelled', error: createError('boom') }, stderr)).toBe(EXIT_ERROR)
    expect(drain(stderr)).toBe('boom\n')
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
      return { steps: [], config: {} } as AuthorSession
    }
  }

  it('returns 0 when the session commits', async () => {
    const stderr = new PassThrough()
    const load = { options: undefined as LoadCommitConfigOptions | undefined }
    const create = { options: undefined as CreateAuthorSessionOptions | undefined }

    const code = await runCz({
      argv: ['--cwd', '/repo', '--config', './cfg.cjs'],
      cwd: '/other',
      stderr,
      loadConfig: stubLoad(load),
      createSession: stubCreateSession(create),
      runSession: async () => ({ status: 'committed', message: 'feat: x' }),
    })

    expect(code).toBe(EXIT_COMMITTED)
    expect(load.options).toEqual({ cwd: '/repo', overridePath: './cfg.cjs' })
    expect(create.options?.config?.cwd).toBe('/repo')
    expect(drain(stderr)).toBe('')
  })

  it('returns 130 when the session is cancelled cleanly', async () => {
    const stderr = new PassThrough()
    const code = await runCz({
      argv: [],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'cancelled' }),
    })

    expect(code).toBe(EXIT_SIGINT)
    expect(drain(stderr)).toBe('')
  })

  it('returns 1 and echoes the error message for an error cancellation', async () => {
    const stderr = new PassThrough()
    const code = await runCz({
      argv: [],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'cancelled', error: createError('No staged changes') }),
    })

    expect(code).toBe(EXIT_ERROR)
    expect(drain(stderr)).toBe('No staged changes\n')
  })

  it('returns 1 when argv parsing fails', async () => {
    const stderr = new PassThrough()
    const code = await runCz({
      argv: ['--bogus'],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(code).toBe(EXIT_ERROR)
    expect(drain(stderr)).toBe('Unknown argument: --bogus\n')
  })

  it('returns 1 and echoes the thrown error when config loading fails', async () => {
    const stderr = new PassThrough()
    const code = await runCz({
      argv: [],
      cwd: '/repo',
      stderr,
      loadConfig: async () => {
        throw createError('Config file not found: /nope')
      },
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(code).toBe(EXIT_ERROR)
    expect(drain(stderr)).toBe('Config file not found: /nope\n')
  })

  it('stringifies non-Error throws before writing them', async () => {
    const stderr = new PassThrough()
    const code = await runCz({
      argv: [],
      cwd: '/repo',
      stderr,
      loadConfig: async () => {
        throw 'plain string failure'
      },
      createSession: stubCreateSession({}),
      runSession: async () => ({ status: 'committed', message: 'x' }),
    })

    expect(code).toBe(EXIT_ERROR)
    expect(drain(stderr)).toBe('plain string failure\n')
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
