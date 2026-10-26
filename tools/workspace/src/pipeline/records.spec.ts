import type { Plan, RunResults, TaskResult } from './model'
import type { RunIdentity, RunIndexEntry } from './records'
import { describe, expect, it } from '@hyperfrontend/testing'
import { indexEntry, recordOutcome, runRecord, updateIndex, writeRunRecord } from './records'

/** Which workflow run the records are of. */
const RUN: RunIdentity = {
  id: 10,
  number: 3,
  attempt: 1,
  sha: 'abc',
  ref: 'refs/heads/main',
  event: 'push',
  url: 'https://example/runs/10',
}

/** A plan with a chain on each environment. */
const PLAN: Plan = {
  base: 'base',
  head: 'abc',
  mode: 'affected',
  main: true,
  targets: ['test'],
  drift: [],
  chains: [
    {
      project: 'lib-a',
      environment: 'linux',
      order: 0,
      tasks: [
        {
          id: 'lib-a:test',
          project: 'lib-a',
          target: 'test',
          environment: 'linux',
          needs: [],
          weight: 'light',
          reasons: [],
          command: [],
          env: {},
        },
      ],
    },
    {
      project: 'lib-a',
      environment: 'windows',
      order: 1,
      tasks: [
        {
          id: 'lib-a:test',
          project: 'lib-a',
          target: 'test',
          environment: 'windows',
          needs: [],
          weight: 'light',
          reasons: [],
          command: [],
          env: {},
        },
      ],
    },
  ],
  skipped: [],
  environments: ['linux', 'windows'],
}

/**
 * The results of one environment.
 *
 * @param environment - Linux or Windows
 * @param outcome - How its one task ended
 * @param complete - Whether the run ended
 * @returns The results of its one task
 */
function results(environment: 'linux' | 'windows', outcome: TaskResult['outcome'], complete = true): RunResults {
  return {
    environment,
    base: 'base',
    head: 'abc',
    mode: 'affected',
    startedAt: 0,
    endedAt: 10,
    durationMs: 10,
    complete,
    tasks: [
      {
        id: 'lib-a:test',
        project: 'lib-a',
        target: 'test',
        environment,
        reasons: [],
        outcome,
        exitCode: outcome === 'success' ? 0 : 1,
        detail: null,
        startedAt: 0,
        endedAt: 10,
        durationMs: 10,
        log: null,
      },
    ],
  }
}

describe('recordOutcome', () => {
  it.each([
    [{ linux: results('linux', 'success'), windows: results('windows', 'success') }, 'success'],
    [{ linux: results('linux', 'failure'), windows: results('windows', 'success') }, 'failure'],
    [{ linux: results('linux', 'success'), windows: results('windows', 'skipped') }, 'failure'],
    [{ linux: results('linux', 'cancelled'), windows: results('windows', 'success') }, 'cancelled'],
    [{ linux: results('linux', 'success') }, 'incomplete'],
    [{ linux: results('linux', 'success'), windows: results('windows', 'success', false) }, 'incomplete'],
  ])('reads %j as %s', (environments, outcome) => {
    expect(recordOutcome(runRecord(RUN, PLAN, environments, 99))).toBe(outcome)
  })
})

describe('indexEntry', () => {
  it('lists the run with its counts and outcome', () => {
    expect(indexEntry(runRecord(RUN, PLAN, { linux: results('linux', 'success'), windows: results('windows', 'success') }, 99))).toEqual({
      ...RUN,
      recordedAt: 99,
      mode: 'affected',
      main: true,
      environments: ['linux', 'windows'],
      chains: 2,
      tasks: 2,
      outcome: 'success',
    })
  })
})

describe('updateIndex', () => {
  const entry = (id: number, number: number): RunIndexEntry => ({
    ...RUN,
    id,
    number,
    recordedAt: 0,
    mode: 'affected',
    main: true,
    environments: ['linux'],
    chains: 1,
    tasks: 1,
    outcome: 'success',
  })

  it('starts an index', () => {
    expect(updateIndex(null, entry(10, 3))).toEqual({ schema: 1, runs: [entry(10, 3)] })
  })

  it('keeps the newest first, replaces a run recorded again and keeps no more than the limit', () => {
    const index = updateIndex({ schema: 1, runs: [entry(12, 5), entry(10, 3)] }, entry(11, 4), 2)
    expect(index.runs.map((run) => run.number)).toEqual([5, 4])
  })

  it('replaces a run recorded again', () => {
    const index = updateIndex({ schema: 1, runs: [entry(10, 3)] }, { ...entry(10, 3), outcome: 'failure' })
    expect(index.runs).toEqual([{ ...entry(10, 3), outcome: 'failure' }])
  })
})

describe('writeRunRecord', () => {
  it('writes the record, the index with the run listed, and the graph document', () => {
    const written: [string, unknown][] = []
    const index = writeRunRecord(
      { run: RUN, plan: PLAN, results: { linux: results('linux', 'success') }, explorer: { schema: 1 } as never, recordedAt: 5 },
      { write: (path, value) => written.push([path, value]), readIndex: () => null }
    )
    expect({ paths: written.map(([path]) => path), listed: index.runs.map((run) => [run.id, run.outcome]) }).toEqual({
      paths: ['runs/10.json', 'index.json', 'graph/latest.json'],
      listed: [[10, 'incomplete']],
    })
  })

  it('writes no graph document when the run uploaded none', () => {
    const written: string[] = []
    writeRunRecord(
      { run: RUN, plan: PLAN, results: {}, explorer: null, recordedAt: 5 },
      { write: (path) => written.push(path), readIndex: () => ({ schema: 1, runs: [] }) }
    )
    expect(written).toEqual(['runs/10.json', 'index.json'])
  })
})
