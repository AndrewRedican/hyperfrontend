import type { ChainState, CompactPlan, Environment, GitHubCheckRun, GitHubRun, RunRecord, TaskResult } from '../model'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** The epoch the fixtures count from. */
export const T0 = 1_700_000_000_000

/**
 * A planned task of a record.
 *
 * @param id - `<project>:<target>`
 * @param environment - Where it runs
 * @param needs - What must succeed first
 * @returns The task, light unless it is a build
 */
export function plannedTask(
  id: string,
  environment: Environment,
  needs: string[] = []
): RunRecord['plan']['chains'][number]['tasks'][number] {
  const [project, target] = id.split(':') as [string, string]
  return {
    id,
    project,
    target,
    environment,
    needs,
    weight: target === 'build' ? 'heavy' : 'light',
    reasons: [{ rule: 'changed-input', file: 'src/index.ts', path: [], message: 'an input changed' }],
    reasonsOmitted: 0,
  }
}

/**
 * A task's result.
 *
 * @param id - `<project>:<target>`
 * @param environment - Where it ran
 * @param startMs - When it started, after the epoch
 * @param endMs - When it ended, after the epoch
 * @param outcome - What it ended as
 * @returns The result, with the exit code and detail the outcome implies
 */
export function taskResult(
  id: string,
  environment: Environment,
  startMs: number,
  endMs: number,
  outcome: TaskResult['outcome'] = 'success'
): TaskResult {
  const [project, target] = id.split(':') as [string, string]
  return {
    id,
    project,
    target,
    environment,
    outcome,
    exitCode: outcome === 'success' ? 0 : outcome === 'failure' ? 1 : null,
    detail: outcome === 'skipped' ? 'prerequisite-failed: x' : null,
    startedAt: T0 + startMs,
    endedAt: T0 + endMs,
    durationMs: endMs - startMs,
  }
}

/**
 * A record of one run: `lib-a` on Linux and Windows, `lib-b` on Linux alone.
 *
 * @returns The record, every task of both environments with a result
 */
export function sampleRecord(): RunRecord {
  return {
    schema: 1,
    run: {
      id: 1,
      number: 10,
      attempt: 1,
      sha: 'abcdef1234567890',
      ref: 'refs/heads/main',
      event: 'push',
      url: 'https://example.test/runs/1',
    },
    recordedAt: T0 + 100_000,
    plan: {
      base: 'base',
      head: 'head',
      mode: 'affected',
      main: true,
      environments: ['linux', 'windows'],
      chains: [
        {
          project: 'lib-a',
          environment: 'linux',
          order: 0,
          tasks: [
            plannedTask('lib-a:typecheck', 'linux'),
            plannedTask('lib-a:build', 'linux', ['lib-a:typecheck']),
            plannedTask('lib-a:publish', 'linux', ['lib-a:build', 'lib-a:typecheck']),
          ],
        },
        {
          project: 'lib-b',
          environment: 'linux',
          order: 1,
          tasks: [plannedTask('lib-b:lint', 'linux'), plannedTask('lib-b:test', 'linux')],
        },
        {
          project: 'lib-a',
          environment: 'windows',
          order: 2,
          tasks: [plannedTask('lib-a:typecheck', 'windows'), plannedTask('lib-a:build', 'windows', ['lib-a:typecheck'])],
        },
      ],
      skipped: [
        { task: 'lib-c:test', reasons: [{ rule: 'unreachable', file: null, path: [], message: 'nothing reaches it' }], reasonsOmitted: 0 },
      ],
    },
    results: {
      linux: {
        environment: 'linux',
        startedAt: T0,
        endedAt: T0 + 60_000,
        durationMs: 60_000,
        complete: true,
        tasks: [
          taskResult('lib-a:typecheck', 'linux', 0, 10_000),
          taskResult('lib-a:build', 'linux', 10_000, 40_000),
          taskResult('lib-a:publish', 'linux', 40_000, 60_000),
          taskResult('lib-b:lint', 'linux', 0, 5_000, 'failure'),
          taskResult('lib-b:test', 'linux', 1_000, 30_000),
        ],
      },
      windows: {
        environment: 'windows',
        startedAt: T0 + 5_000,
        endedAt: T0 + 50_000,
        durationMs: 45_000,
        complete: true,
        tasks: [taskResult('lib-a:typecheck', 'windows', 5_000, 15_000), taskResult('lib-a:build', 'windows', 15_000, 50_000)],
      },
    },
  }
}

/**
 * A run as GitHub lists it.
 *
 * @param overrides - Fields to change
 * @returns The run, in progress on main unless overridden
 */
export function githubRun(overrides: Partial<GitHubRun> = {}): GitHubRun {
  return {
    id: 2,
    run_number: 11,
    run_attempt: 1,
    path: '.github/workflows/ci-main.yml',
    head_sha: 'fedcba0987654321',
    head_branch: 'main',
    event: 'push',
    status: 'in_progress',
    conclusion: null,
    html_url: 'https://example.test/runs/2',
    created_at: '2023-11-14T22:13:20.000Z',
    run_started_at: '2023-11-14T22:13:20.000Z',
    updated_at: '2023-11-14T22:14:20.000Z',
    display_title: 'feat: something',
    check_suite_id: 99,
    ...overrides,
  }
}

/**
 * A check run of a suite.
 *
 * @param name - Its name
 * @param overrides - Fields to change
 * @returns The check run, in progress with no output unless overridden
 */
export function checkRun(name: string, overrides: Partial<GitHubCheckRun> = {}): GitHubCheckRun {
  return {
    id: name.length,
    name,
    status: 'in_progress',
    conclusion: null,
    started_at: '2023-11-14T22:13:30.000Z',
    completed_at: null,
    html_url: `https://example.test/checks/${name}`,
    output: { title: null, summary: null, text: null },
    check_suite: { id: 99 },
    ...overrides,
  }
}

/**
 * The compact plan of the sample record, as the `pipeline plan` check run carries it.
 *
 * @param truncated - Whether the needs are dropped
 * @returns The plan the check run text carries
 */
export function samplePlan(truncated = false): CompactPlan {
  const record = sampleRecord()
  return {
    schema: 1,
    base: 'base',
    head: 'head',
    mode: 'affected',
    main: true,
    environments: ['linux', 'windows'],
    chains: record.plan.chains.map((chain) => ({
      project: chain.project,
      environment: chain.environment,
      order: chain.order,
      tasks: chain.tasks.map((task) => ({ id: task.id, target: task.target, weight: task.weight, needs: truncated ? [] : task.needs })),
    })),
    skipped: 1,
    truncated,
  }
}

/**
 * The check runs of a suite in the middle of the sample run: the plan published, Linux running
 * with `lib-a` built and `lib-b` still going, Windows not started.
 *
 * @returns The check runs, the plan's among them
 */
export function sampleCheckRuns(): GitHubCheckRun[] {
  const linuxA: ChainState = {
    schema: 1,
    project: 'lib-a',
    environment: 'linux',
    total: 3,
    tasks: [
      { id: 'lib-a:typecheck', outcome: 'success', exitCode: 0, detail: null, startedAt: T0, endedAt: T0 + 10_000 },
      { id: 'lib-a:build', outcome: 'success', exitCode: 0, detail: null, startedAt: T0 + 10_000, endedAt: T0 + 40_000 },
    ],
  }
  const linuxB: ChainState = {
    schema: 1,
    project: 'lib-b',
    environment: 'linux',
    total: 2,
    tasks: [{ id: 'lib-b:lint', outcome: 'failure', exitCode: 1, detail: null, startedAt: T0, endedAt: T0 + 5_000 }],
  }
  return [
    checkRun('plan', {
      status: 'completed',
      conclusion: 'success',
      started_at: '2023-11-14T22:13:21.000Z',
      completed_at: '2023-11-14T22:13:29.000Z',
    }),
    checkRun('pipeline plan', {
      status: 'completed',
      conclusion: 'success',
      output: { title: null, summary: null, text: stringify(samplePlan()) },
    }),
    checkRun('linux'),
    checkRun('lib-a (linux)', { output: { title: null, summary: null, text: stringify(linuxA) } }),
    checkRun('lib-b (linux)', { output: { title: null, summary: null, text: stringify(linuxB) } }),
    checkRun('status', { status: 'queued', started_at: null }),
  ]
}
