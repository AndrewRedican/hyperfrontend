import type { CheckOutput } from './checks'
import type { Plan, RunResults, TaskResult } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { settleChecks } from './finalize'

/** A plan of two chains. */
const PLAN: Plan = {
  base: 'abc',
  head: null,
  mode: 'affected',
  main: false,
  targets: ['build'],
  drift: [],
  chains: [
    {
      project: 'lib-a',
      environment: 'linux',
      order: 0,
      tasks: [
        {
          id: 'lib-a:typecheck',
          project: 'lib-a',
          target: 'typecheck',
          environment: 'linux',
          needs: [],
          weight: 'light',
          reasons: [],
          command: [],
          env: {},
        },
        {
          id: 'lib-a:build',
          project: 'lib-a',
          target: 'build',
          environment: 'linux',
          needs: ['lib-a:typecheck'],
          weight: 'heavy',
          reasons: [],
          command: [],
          env: {},
        },
      ],
    },
    {
      project: 'lib-b',
      environment: 'linux',
      order: 1,
      tasks: [
        {
          id: 'lib-b:build',
          project: 'lib-b',
          target: 'build',
          environment: 'linux',
          needs: [],
          weight: 'heavy',
          reasons: [],
          command: [],
          env: {},
        },
      ],
    },
  ],
  skipped: [],
  environments: ['linux'],
}

/** The one task that had ended. */
const ENDED: TaskResult = {
  id: 'lib-a:typecheck',
  project: 'lib-a',
  target: 'typecheck',
  environment: 'linux',
  reasons: [],
  outcome: 'success',
  exitCode: 0,
  detail: null,
  startedAt: 0,
  endedAt: 500,
  durationMs: 500,
  log: null,
}

/** The partial results of a run that was killed. */
const RESULTS: RunResults = {
  environment: 'linux',
  base: 'abc',
  head: null,
  mode: 'affected',
  startedAt: 0,
  endedAt: 600,
  durationMs: 600,
  complete: false,
  tasks: [ENDED],
}

/**
 * An API recording its completions.
 *
 * @returns The API and the calls
 */
function recording(): { api: { complete(id: number, conclusion: string, output: CheckOutput): Promise<void> }; calls: unknown[] } {
  const calls: unknown[] = []
  return {
    calls,
    api: {
      complete: async (id, conclusion, output) => {
        calls.push([id, conclusion, output.title, output.summary.split(/\r?\n/).length])
      },
    },
  }
}

describe('settleChecks', () => {
  it('completes the open check runs as cancelled with the tasks that had ended, and leaves the completed ones', async () => {
    const { api, calls } = recording()
    const settlement = await settleChecks({
      records: {
        'lib-a (linux)': { id: 1, completed: false },
        'lib-b (linux)': { id: 2, completed: false },
        'lib-c (linux)': { id: 3, completed: true },
      },
      plan: PLAN,
      results: RESULTS,
      api,
    })
    expect({ calls, settlement }).toEqual({
      calls: [
        [1, 'cancelled', 'the run ended before the chain finished; 1 of 2 tasks had ended', 5],
        [2, 'cancelled', 'the run ended before the chain finished; no task of it had ended', 4],
      ],
      settlement: {
        records: {
          'lib-a (linux)': { id: 1, completed: true },
          'lib-b (linux)': { id: 2, completed: true },
          'lib-c (linux)': { id: 3, completed: true },
        },
        settled: ['lib-a (linux)', 'lib-b (linux)'],
      },
    })
  })

  it('settles a check run whose plan is not at hand', async () => {
    const { api, calls } = recording()
    await settleChecks({ records: { 'lib-a (linux)': { id: 1, completed: false } }, plan: null, results: null, api })
    expect(calls).toEqual([[1, 'cancelled', 'the run ended before the chain finished', 1]])
  })

  it('does nothing when every check run was completed', async () => {
    const { api, calls } = recording()
    const settlement = await settleChecks({ records: { 'lib-a (linux)': { id: 1, completed: true } }, plan: PLAN, results: null, api })
    expect({ calls, settled: settlement.settled }).toEqual({ calls: [], settled: [] })
  })
})
