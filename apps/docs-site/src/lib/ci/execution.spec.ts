import { describe, expect, it } from 'vitest'
import { T0, checkRun, githubRun, sampleCheckRuns, sampleRecord } from './__test-utils__/fixtures'
import {
  allTasks,
  branchOf,
  conclusionOf,
  countStates,
  epochOf,
  fromLive,
  fromRecord,
  outcomeOfConclusion,
  planCheckFor,
  spanOf,
  workflowOf,
} from './execution'

describe('fromRecord', () => {
  it('identifies the run with its branch and the ci workflow', () => {
    expect(fromRecord(sampleRecord()).run).toEqual(
      expect.objectContaining({ id: 1, number: 10, sha: 'abcdef1234567890', branch: 'main', event: 'push', workflow: 'ci' })
    )
  })

  it('gives every task its recorded outcome and timing', () => {
    const task = allTasks(fromRecord(sampleRecord())).find(
      (candidate) => candidate.id === 'lib-a:build' && candidate.environment === 'linux'
    )
    expect(task).toEqual(
      expect.objectContaining({ state: 'success', startedAt: T0 + 10_000, endedAt: T0 + 40_000, durationMs: 30_000, weight: 'heavy' })
    )
  })

  it('keeps the reasons a record holds', () => {
    expect(allTasks(fromRecord(sampleRecord()))[0]?.reasons).toEqual([expect.objectContaining({ rule: 'changed-input' })])
  })

  it('concludes a chain from its tasks', () => {
    expect(fromRecord(sampleRecord()).chains.map((chain) => [chain.project, chain.environment, chain.status])).toEqual([
      ['lib-a', 'linux', 'success'],
      ['lib-b', 'linux', 'failure'],
      ['lib-a', 'windows', 'success'],
    ])
  })

  it('spans a chain from its first start to its last end', () => {
    expect(fromRecord(sampleRecord()).chains[1]).toEqual(expect.objectContaining({ startedAt: T0, endedAt: T0 + 30_000 }))
  })

  it('completes every lane with its results', () => {
    expect(fromRecord(sampleRecord()).lanes).toEqual([
      expect.objectContaining({
        environment: 'linux',
        status: 'completed',
        conclusion: 'failure',
        startedAt: T0,
        endedAt: T0 + 60_000,
        complete: true,
      }),
      expect.objectContaining({ environment: 'windows', status: 'completed', conclusion: 'success', complete: true }),
    ])
  })

  it('runs the clock from the first lane start to the last lane end', () => {
    expect(fromRecord(sampleRecord()).clock).toEqual({ start: T0, end: T0 + 60_000 })
  })

  it('fails the run when a task failed', () => {
    expect(fromRecord(sampleRecord())).toEqual(expect.objectContaining({ status: 'completed', outcome: 'failure', source: 'record' }))
  })

  it('marks a run incomplete when a lane uploaded nothing', () => {
    const record = sampleRecord()
    const execution = fromRecord({ ...record, results: { linux: record.results.linux } })
    expect({ outcome: execution.outcome, windows: execution.lanes[1], task: execution.chains[2]?.tasks[0]?.state }).toEqual({
      outcome: 'incomplete',
      windows: expect.objectContaining({ complete: false, conclusion: null, startedAt: null }),
      task: 'unknown',
    })
  })

  it('counts the skipped tasks of the plan', () => {
    expect(fromRecord(sampleRecord()).plan).toEqual(expect.objectContaining({ mode: 'affected', main: true, skipped: 1, truncated: false }))
  })
})

describe('fromLive', () => {
  const readAt = T0 + 45_000

  it('reads the plan from its check run', () => {
    expect(fromLive(githubRun(), sampleCheckRuns(), readAt).plan).toEqual(
      expect.objectContaining({ mode: 'affected', skipped: 1, truncated: false, environments: ['linux', 'windows'] })
    )
  })

  it('leaves the plan null before it is published', () => {
    expect(fromLive(githubRun(), [checkRun('linux')], readAt).plan).toBeNull()
  })

  it('gives an ended task its outcome and timing', () => {
    const task = fromLive(githubRun(), sampleCheckRuns(), readAt).chains[0]?.tasks[1]
    expect(task).toEqual(
      expect.objectContaining({ id: 'lib-a:build', state: 'success', startedAt: T0 + 10_000, endedAt: T0 + 40_000, durationMs: 30_000 })
    )
  })

  it('marks a task ready when every need succeeded', () => {
    expect(fromLive(githubRun(), sampleCheckRuns(), readAt).chains[0]?.tasks[2]?.state).toBe('ready')
  })

  it('marks a task blocked while a need has not succeeded', () => {
    const checks = sampleCheckRuns().map((check) =>
      check.name === 'lib-a (linux)'
        ? { ...check, output: { ...check.output, text: check.output.text?.replace(/,\{"id":"lib-a:build"[^}]*\}/, '') ?? null } }
        : check
    )
    expect(fromLive(githubRun(), checks, readAt).chains[0]?.tasks.map((task) => task.state)).toEqual(['success', 'ready', 'blocked'])
  })

  it('marks the tasks of a chain without a check run queued', () => {
    expect(fromLive(githubRun(), sampleCheckRuns(), readAt).chains[2]?.tasks.map((task) => task.state)).toEqual(['queued', 'queued'])
  })

  it('marks a chain running while its check run is in progress', () => {
    expect(fromLive(githubRun(), sampleCheckRuns(), readAt).chains.map((chain) => chain.status)).toEqual(['running', 'running', 'queued'])
  })

  it('reads the lanes from the environment check runs', () => {
    expect(fromLive(githubRun(), sampleCheckRuns(), readAt).lanes).toEqual([
      expect.objectContaining({ environment: 'linux', status: 'running', url: 'https://example.test/checks/linux' }),
      expect.objectContaining({ environment: 'windows', status: 'queued', startedAt: null }),
    ])
  })

  it('keeps the other jobs as stages in start order', () => {
    expect(fromLive(githubRun(), sampleCheckRuns(), readAt).stages.map((stage) => [stage.name, stage.status])).toEqual([
      ['status', 'queued'],
      ['plan', 'completed'],
    ])
  })

  it('runs the clock to the read while the run is in progress', () => {
    expect(fromLive(githubRun(), sampleCheckRuns(), readAt).clock).toEqual({ start: epochOf('2023-11-14T22:13:20.000Z'), end: readAt })
  })

  it('ends the clock at the last job once completed', () => {
    const run = githubRun({ status: 'completed', conclusion: 'success', updated_at: '2023-11-14T22:20:00.000Z' })
    expect(fromLive(run, sampleCheckRuns(), readAt)).toEqual(
      expect.objectContaining({
        status: 'completed',
        outcome: 'success',
        clock: { start: epochOf(run.run_started_at), end: epochOf(run.updated_at) },
      })
    )
  })

  it('marks unended tasks unknown once their lane completed without listing them', () => {
    const checks = sampleCheckRuns().map((check) =>
      check.name === 'linux' ? { ...check, status: 'completed', conclusion: 'failure' } : check
    )
    expect(fromLive(githubRun(), checks, readAt).chains[0]?.tasks[2]?.state).toBe('unknown')
  })

  it('treats every unended task as ready when the plan dropped its needs', () => {
    const checks = sampleCheckRuns().map((check) =>
      check.name === 'pipeline plan'
        ? { ...check, output: { ...check.output, text: check.output.text?.replace('"truncated":false', '"truncated":true') ?? null } }
        : check
    )
    expect(fromLive(githubRun(), checks, readAt).plan?.truncated).toBe(true)
  })
})

describe('helpers', () => {
  it.each([
    ['refs/heads/main', 'main'],
    ['refs/tags/v1', null],
  ])('reads the branch of %s', (ref, branch) => {
    expect(branchOf(ref)).toBe(branch)
  })

  it.each([
    ['.github/workflows/ci-main.yml', 'ci'],
    ['.github/workflows/ci-pr.yml', 'pr'],
    ['.github/workflows/full-run.yml', 'other'],
  ])('names the workflow of %s', (path, workflow) => {
    expect(workflowOf(path)).toBe(workflow)
  })

  it.each([
    ['success', 'success'],
    ['cancelled', 'cancelled'],
    ['timed_out', 'failure'],
    ['neutral', null],
    [null, null],
  ])('maps the conclusion %s', (conclusion, outcome) => {
    expect(outcomeOfConclusion(conclusion)).toBe(outcome)
  })

  it('reads an ISO time', () => {
    expect(epochOf('2023-11-14T22:13:20.000Z')).toBe(1_700_000_000_000)
  })

  it('reads nothing from a missing time', () => {
    expect(epochOf(null)).toBeNull()
  })

  it('fails a conclusion over a skipped task', () => {
    expect(conclusionOf(['success', 'skipped'])).toBe('failure')
  })

  it('cancels a conclusion with no failure', () => {
    expect(conclusionOf(['success', 'cancelled'])).toBe('cancelled')
  })

  it('spans known times only', () => {
    expect(spanOf([null, 5, 3], [null, 9, 4])).toEqual({ start: 3, end: 9 })
  })

  it('picks the plan check run that started first after the run', () => {
    const candidates = [
      checkRun('pipeline plan', { id: 1, started_at: '2023-11-14T22:00:00.000Z' }),
      checkRun('pipeline plan', { id: 3, started_at: '2023-11-14T23:30:00.000Z' }),
      checkRun('pipeline plan', { id: 2, started_at: '2023-11-14T22:14:00.000Z' }),
    ]
    expect(planCheckFor(candidates, epochOf('2023-11-14T22:13:20.000Z'))?.id).toBe(2)
  })

  it('falls back to the newest plan check run', () => {
    const candidates = [
      checkRun('pipeline plan', { id: 1, started_at: '2023-11-14T22:00:00.000Z' }),
      checkRun('pipeline plan', { id: 2, started_at: '2023-11-14T22:14:00.000Z' }),
    ]
    expect(planCheckFor(candidates, epochOf('2023-11-15T00:00:00.000Z'))?.id).toBe(2)
  })

  it('finds no plan check run among none', () => {
    expect(planCheckFor([], null)).toBeNull()
  })

  it('counts every state', () => {
    expect(countStates(allTasks(fromRecord(sampleRecord())))).toEqual(expect.objectContaining({ success: 6, failure: 1, unknown: 0 }))
  })
})
