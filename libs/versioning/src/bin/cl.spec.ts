import type { LoadCommitConfigOptions, LoadedCommitConfig } from '../commits/author/config-loader/load'
import type { Ruleset, ValidationResult } from '../commits/validate/models/ruleset'
import { PassThrough } from 'node:stream'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { CL_EXIT_INVALID, CL_EXIT_VALID, formatValidationResult, parseClArgs, runCl } from './cl'

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

describe('parseClArgs', () => {
  it('captures the message path positional', () => {
    expect(parseClArgs(['.git/COMMIT_EDITMSG'])).toEqual({ messagePath: '.git/COMMIT_EDITMSG' })
  })

  it('captures --config alongside the positional in any order', () => {
    expect(parseClArgs(['--config', 'c.cjs', '/tmp/msg.txt'])).toEqual({ messagePath: '/tmp/msg.txt', configPath: 'c.cjs' })
    expect(parseClArgs(['/tmp/msg.txt', '--config', 'c.cjs'])).toEqual({ messagePath: '/tmp/msg.txt', configPath: 'c.cjs' })
  })

  it('captures --cwd alongside the positional', () => {
    expect(parseClArgs(['--cwd', '/repo', '/tmp/msg.txt'])).toEqual({ messagePath: '/tmp/msg.txt', cwdOverride: '/repo' })
  })

  it('throws when no positional is supplied', () => {
    expect(() => parseClArgs([])).toThrow(/requires a commit-message file path/)
  })

  it('throws when --config is missing its value', () => {
    expect(() => parseClArgs(['--config'])).toThrow(/--config requires a path/)
  })

  it('throws when --cwd is missing its value', () => {
    expect(() => parseClArgs(['--cwd'])).toThrow(/--cwd requires a path/)
  })

  it('throws on unknown flags', () => {
    expect(() => parseClArgs(['--bogus', '/tmp/msg.txt'])).toThrow(/Unknown argument: --bogus/)
  })

  it('throws when more than one positional is supplied', () => {
    expect(() => parseClArgs(['/tmp/msg.txt', '/tmp/other.txt'])).toThrow(/Unexpected extra argument/)
  })
})

describe('formatValidationResult', () => {
  it('returns an empty string for a clean result', () => {
    expect(formatValidationResult({ valid: true, errors: [], warnings: [] })).toBe('')
  })

  it('renders errors before warnings with distinguishing glyphs', () => {
    const report = formatValidationResult({
      valid: false,
      errors: [{ level: 'error', ruleName: 'type-enum', message: 'must be feat|fix' }],
      warnings: [{ level: 'warn', ruleName: 'header-max-length', message: 'too long' }],
    })
    expect(report).toBe('✖ type-enum: must be feat|fix\n⚠ header-max-length: too long')
  })
})

describe('runCl', () => {
  /**
   * Canned validator that returns whatever the test wires up.
   *
   * @param result - Validation result the stub should always return
   * @returns Validator function ignoring its inputs and returning `result`
   */
  function validatorReturning(result: ValidationResult): (raw: string, ruleset: Ruleset) => ValidationResult {
    return () => result
  }

  it('returns 0 and writes nothing when the message is valid', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: ['/tmp/msg.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      readMessage: () => 'feat: add login',
      validate: validatorReturning({ valid: true, errors: [], warnings: [] }),
    })

    expect(code).toBe(CL_EXIT_VALID)
    expect(drain(stderr)).toBe('')
  })

  it('writes warnings even when the result is valid', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: ['/tmp/msg.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      readMessage: () => 'feat: add login',
      validate: validatorReturning({
        valid: true,
        errors: [],
        warnings: [{ level: 'warn', ruleName: 'imperative-mood', message: 'use imperative' }],
      }),
    })

    expect(code).toBe(CL_EXIT_VALID)
    expect(drain(stderr)).toBe('⚠ imperative-mood: use imperative\n')
  })

  it('returns 1 and writes the report when the message is invalid', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: ['/tmp/msg.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      readMessage: () => 'not conventional',
      validate: validatorReturning({
        valid: false,
        errors: [{ level: 'error', ruleName: 'type-enum', message: 'must be feat|fix' }],
        warnings: [],
      }),
    })

    expect(code).toBe(CL_EXIT_INVALID)
    expect(drain(stderr)).toBe('✖ type-enum: must be feat|fix\n')
  })

  it('returns 1 when argv parsing fails', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: [],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      readMessage: () => 'irrelevant',
      validate: validatorReturning({ valid: true, errors: [], warnings: [] }),
    })

    expect(code).toBe(CL_EXIT_INVALID)
    expect(drain(stderr)).toBe('cl requires a commit-message file path\n')
  })

  it('returns 1 when reading the message file fails', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: ['/tmp/missing.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      readMessage: () => {
        throw createError('ENOENT: no such file')
      },
      validate: validatorReturning({ valid: true, errors: [], warnings: [] }),
    })

    expect(code).toBe(CL_EXIT_INVALID)
    expect(drain(stderr)).toBe('ENOENT: no such file\n')
  })

  it('stringifies non-Error throws from readMessage', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: ['/tmp/missing.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: stubLoad({}),
      readMessage: () => {
        throw 'disk failure'
      },
      validate: validatorReturning({ valid: true, errors: [], warnings: [] }),
    })

    expect(code).toBe(CL_EXIT_INVALID)
    expect(drain(stderr)).toBe('disk failure\n')
  })

  it('returns 1 when config loading fails', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: ['/tmp/msg.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: async () => {
        throw createError('bogus config')
      },
      readMessage: () => 'feat: add login',
      validate: validatorReturning({ valid: true, errors: [], warnings: [] }),
    })

    expect(code).toBe(CL_EXIT_INVALID)
    expect(drain(stderr)).toBe('bogus config\n')
  })

  it('stringifies non-Error throws from loadConfig', async () => {
    const stderr = new PassThrough()
    const code = await runCl({
      argv: ['/tmp/msg.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: async () => {
        throw 'odd failure'
      },
      readMessage: () => 'feat: add login',
      validate: validatorReturning({ valid: true, errors: [], warnings: [] }),
    })

    expect(code).toBe(CL_EXIT_INVALID)
    expect(drain(stderr)).toBe('odd failure\n')
  })

  it('forwards --config and --cwd to loadCommitConfig', async () => {
    const stderr = new PassThrough()
    const capture = { options: undefined as LoadCommitConfigOptions | undefined }

    await runCl({
      argv: ['/tmp/msg.txt', '--config', './cfg.cjs', '--cwd', '/work'],
      cwd: '/ignored',
      stderr,
      loadConfig: stubLoad(capture),
      readMessage: () => 'feat: add login',
      validate: validatorReturning({ valid: true, errors: [], warnings: [] }),
    })

    expect(capture.options).toEqual({ cwd: '/work', overridePath: './cfg.cjs' })
  })

  it('uses the ruleset from config when present', async () => {
    const customRuleset: Ruleset = { 'type-enum': ['off'] }
    const stderr = new PassThrough()
    let seenRuleset: Ruleset | undefined

    await runCl({
      argv: ['/tmp/msg.txt'],
      cwd: '/repo',
      stderr,
      loadConfig: async () => ({ config: { validateRuleset: customRuleset } }),
      readMessage: () => 'feat: add login',
      validate: (_raw, ruleset) => {
        seenRuleset = ruleset
        return { valid: true, errors: [], warnings: [] }
      },
    })

    expect(seenRuleset).toBe(customRuleset)
  })
})
