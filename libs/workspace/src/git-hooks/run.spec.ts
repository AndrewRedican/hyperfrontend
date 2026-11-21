import type { HookStep } from './config'
import type { HookHost, HookRun } from './run'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTerminal } from '../progress/terminal'
import { runHook } from './run'

/** What a run answered, wrote and did. */
interface Ran {
  /** The exit code. */
  readonly code: number
  /** The lines written. */
  readonly lines: string[]
  /** The steps started, each with the arguments it received. */
  readonly started: [string, readonly string[]][]
  /** The file lists handed to the re-staging. */
  readonly restaged: (readonly string[])[]
}

/** A format, an audit and a pipeline, as a hook would list them. */
const STEPS: readonly HookStep[] = [
  { name: 'format', run: ['hf', 'format', '--write'], stageFixed: true },
  { name: 'audit', run: ['hf', 'run-many', '-t', 'audit'], failText: 'The audit failed.', passArgs: true },
  { name: 'pipeline', run: ['hf', 'affected', '-t', 'test'] },
]

/**
 * Runs the steps with a clock that advances 1.5 seconds per reading.
 *
 * @param codes - The exit code of a step, by name; a step not named exits with 0
 * @param run - How the run differs from the fixture's
 * @returns The exit code and what was written and done
 */
async function ran(codes: Readonly<Record<string, number>> = {}, run: Partial<HookRun> = {}): Promise<Ran> {
  const lines: string[] = []
  const started: [string, readonly string[]][] = []
  const restaged: (readonly string[])[] = []
  let clock = 0
  const host: HookHost = {
    start: async (step, args) => {
      started.push([step.name, args])
      return codes[step.name] ?? 0
    },
    now: () => (clock += 1500),
    terminal: createTerminal({ write: (text: string) => lines.push(text.trimEnd()) }, {}),
    fullyStaged: jest.fn(() => ['a.ts']),
    restage: (before) => restaged.push(before),
  }
  const code = await runHook({ hook: 'pre-push', steps: STEPS, args: ['origin', 'url'], skipOf: () => null, ...run }, host)
  return { code, lines, started, restaged }
}

describe('runHook', () => {
  it('exits 0 when every step succeeded', async () => {
    expect((await ran()).code).toBe(0)
  })

  it('runs the steps in order, handing the arguments of the hook to the steps that ask for them', async () => {
    expect((await ran()).started).toEqual([
      ['format', []],
      ['audit', ['origin', 'url']],
      ['pipeline', []],
    ])
  })

  it('announces each step and ends on one line per step with its duration', async () => {
    expect((await ran()).lines).toEqual([
      '▸ format',
      '▸ audit',
      '▸ pipeline',
      'pre-push',
      '  ✓ format    1.5s',
      '  ✓ audit     1.5s',
      '  ✓ pipeline  1.5s',
    ])
  })

  it('exits 1 when a step fails', async () => {
    expect((await ran({ audit: 2 })).code).toBe(1)
  })

  it('starts no step after the one that failed', async () => {
    expect((await ran({ audit: 2 })).started.map(([name]) => name)).toEqual(['format', 'audit'])
  })

  it('ends on the failure text of the step that failed, after a list saying what did not run', async () => {
    expect((await ran({ audit: 2 })).lines.slice(2)).toEqual([
      'pre-push',
      '  ✓ format    1.5s',
      '  ✗ audit     1.5s',
      '  · pipeline  not run',
      'The audit failed.',
    ])
  })

  it('ends on the list alone when the step that failed has no failure text', async () => {
    expect((await ran({ pipeline: 1 })).lines.at(-1)).toBe('  ✗ pipeline  1.5s')
  })

  it('does not start a skipped step', async () => {
    expect((await ran({}, { skipOf: (step) => (step === 'audit' ? 'HF_HOOKS_SKIP' : null) })).started.map(([name]) => name)).toEqual([
      'format',
      'pipeline',
    ])
  })

  it('lists a skipped step with what skipped it', async () => {
    expect((await ran({}, { skipOf: (step) => (step === 'audit' ? 'HF_HOOKS_SKIP' : null) })).lines).toContain(
      '  - audit     skipped by HF_HOOKS_SKIP'
    )
  })

  it('stages again what a step fixed, among the files that were fully staged before it', async () => {
    expect((await ran()).restaged).toEqual([['a.ts']])
  })

  it('stages nothing again after a step that failed', async () => {
    expect((await ran({ format: 1 })).restaged).toEqual([])
  })
})
