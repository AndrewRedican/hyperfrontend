import type { Chain, Plan, PlanTask, RunResults, TaskResult } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { taskCommand } from './commands'
import { planReason } from './model'
import { chainTable, describePlanReason, formatDuration, planSummary, runSummary, timelineLines, totalsLine } from './report'

/**
 * A task.
 *
 * @param project - The chain's project
 * @param target - Which target of the project
 * @param needs - What it needs
 * @returns The task, on Linux, with one reason
 */
function task(project: string, target: string, needs: readonly string[] = []): PlanTask {
  return {
    id: `${project}:${target}`,
    project,
    target,
    environment: 'linux',
    needs,
    weight: target === 'build' ? 'heavy' : 'light',
    reasons: [{ rule: 'changed-input', file: `${project}/src/index.ts`, path: [], message: 'the file is an input of the task' }],
    command: taskCommand(`${project}:${target}`),
    env: {},
  }
}

/** A plan of two chains. */
const PLAN: Plan = {
  base: 'abcdef0123456789',
  head: null,
  mode: 'affected',
  main: false,
  targets: ['typecheck', 'build'],
  drift: [],
  chains: [
    { project: 'lib-a', environment: 'linux', order: 0, tasks: [task('lib-a', 'typecheck'), task('lib-a', 'build', ['lib-a:typecheck'])] },
    { project: 'lib-b', environment: 'linux', order: 1, tasks: [task('lib-b', 'typecheck')] },
  ],
  skipped: [{ task: 'lib-c:build', reasons: [planReason('unreachable', 'nothing reaches it', ['file:a', 'file:b'])] }],
  environments: ['linux'],
}

/**
 * A result.
 *
 * @param item - The task
 * @param outcome - How the task ended
 * @param start - When it started, or null when it did not
 * @returns The result as the run records it
 */
function result(item: PlanTask, outcome: TaskResult['outcome'], start: number | null): TaskResult {
  return {
    id: item.id,
    project: item.project,
    target: item.target,
    environment: 'linux',
    reasons: item.reasons,
    outcome,
    exitCode: outcome === 'success' ? 0 : null,
    detail: outcome === 'skipped' ? 'prerequisite-failed: lib-a:typecheck' : null,
    startedAt: start,
    endedAt: start === null ? null : start + 2500,
    durationMs: start === null ? 0 : 2500,
    log: start === null ? null : `logs/${item.id}.log`,
  }
}

/** A run of the plan. */
const RUN: RunResults = {
  environment: 'linux',
  base: PLAN.base,
  head: null,
  mode: 'affected',
  startedAt: 1000,
  endedAt: 9000,
  durationMs: 8000,
  complete: true,
  tasks: [
    result(task('lib-a', 'typecheck'), 'failure', 1000),
    result(task('lib-a', 'build'), 'skipped', null),
    result(task('lib-b', 'typecheck'), 'success', 1500),
  ],
}

describe('formatDuration', () => {
  it.each([
    [800, '0.8s'],
    [47_000, '47s'],
    [1_097_000, '18m 17s'],
  ])('formats %d ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})

describe('describePlanReason', () => {
  it('names the rule, the file and the sentence', () => {
    expect(describePlanReason({ rule: 'changed-input', file: 'a.ts', path: [], message: 'changed' })).toBe('changed-input a.ts: changed')
  })

  it('adds the path when there is one', () => {
    expect(describePlanReason(planReason('folded', 'moved', ['lib-a:build']))).toBe('folded: moved (via lib-a:build)')
  })
})

describe('planSummary', () => {
  it('heads with the counts and the range', () => {
    expect(planSummary(PLAN)[2]).toBe('Affected plan (abcdef012345 → working tree): 2 chains (2 linux), 3 tasks.')
  })

  it('tables the chains in scheduling order', () => {
    expect(planSummary(PLAN).slice(4, 8)).toEqual([
      '| # | chain | environment | tasks |',
      '| --- | --- | --- | --- |',
      '| 0 | lib-a | linux | `typecheck` `build` |',
      '| 1 | lib-b | linux | `typecheck` |',
    ])
  })

  it('explains every task with its needs and reasons', () => {
    expect(planSummary(PLAN)).toEqual(
      expect.arrayContaining([
        '- **lib-a (linux)**',
        '  - `lib-a:build` after lib-a:typecheck',
        '    - changed-input lib-a/src/index.ts: the file is an input of the task',
      ])
    )
  })

  it('lists the skipped tasks with their rules', () => {
    expect(planSummary(PLAN)).toEqual(
      expect.arrayContaining([
        '<details><summary>Skipped tasks (1)</summary>',
        '- `lib-c:build`',
        '  - unreachable: nothing reaches it (via file:a → file:b)',
      ])
    )
  })

  it('lists no skipped section when nothing was skipped', () => {
    expect(planSummary({ ...PLAN, skipped: [] }).slice(-1)).toEqual(['</details>'])
  })

  it('says when nothing runs', () => {
    expect(planSummary({ ...PLAN, chains: [], skipped: [], environments: [] })).toEqual([
      '## Pipeline plan',
      '',
      'Affected plan (abcdef012345 → working tree): 0 chains (), 0 tasks.',
      '',
      'Nothing to run.',
    ])
  })

  it('names the drift, the head and the publishing', () => {
    const lines = planSummary({ ...PLAN, head: '0123456789abcdef', main: true, drift: ['lib-a'] })
    expect(lines.slice(2, 5)).toEqual([
      'Affected plan (abcdef012345 → 0123456789ab): 2 chains (2 linux), 3 tasks, publishing.',
      '',
      'Registry drift: lib-a.',
    ])
  })

  it('describes a full plan without a range', () => {
    expect(planSummary({ ...PLAN, mode: 'all', base: 'all' })[2]).toBe(
      'Full plan (every project, every target): 2 chains (2 linux), 3 tasks.'
    )
  })
})

describe('totalsLine', () => {
  it('counts the outcomes and the times', () => {
    expect(totalsLine(RUN)).toBe('3 tasks (1 success, 1 failure, 1 skipped), wall-clock 8s, runner time 5s.')
  })
})

describe('chainTable', () => {
  it('tables the chain for its check run', () => {
    const chain = PLAN.chains[0] as Chain
    expect(chainTable(chain, RUN.tasks.slice(0, 2))).toEqual([
      'lib-a on linux, 2 tasks.',
      '',
      '| task | outcome | duration | detail |',
      '| --- | --- | --- | --- |',
      '| `lib-a:typecheck` | ❌ failure | 2.5s |  |',
      '| `lib-a:build` | ⏭️ skipped |  | prerequisite-failed: lib-a:typecheck |',
    ])
  })
})

describe('timelineLines', () => {
  it('draws one bar per task that ran, by chain', () => {
    expect(timelineLines(RUN, PLAN)).toEqual([
      '```mermaid',
      'gantt',
      '  title linux',
      '  dateFormat x',
      '  axisFormat %H:%M:%S',
      '  section lib-a',
      '  typecheck (2.5s) :crit, 1000, 3500',
      '  section lib-b',
      '  typecheck (2.5s) :done, 1500, 4000',
      '```',
    ])
  })

  it('leaves out the chains of another environment and the chains that never ran', () => {
    const other: Plan = {
      ...PLAN,
      chains: [
        { ...(PLAN.chains[0] as Chain), environment: 'windows' },
        { ...(PLAN.chains[1] as Chain), project: 'lib-z' },
      ],
    }
    expect(timelineLines(RUN, other)).toEqual(['```mermaid', 'gantt', '  title linux', '  dateFormat x', '  axisFormat %H:%M:%S', '```'])
  })
})

describe('runSummary', () => {
  it('leaves the timeline out when the plan is not at hand', () => {
    expect(runSummary(RUN, null).some((line) => line.startsWith('```mermaid'))).toBe(false)
  })

  it('heads with the environment and the totals, then tables every task', () => {
    expect(runSummary(RUN, PLAN).slice(0, 7)).toEqual([
      '## Pipeline run (linux)',
      '',
      '3 tasks (1 success, 1 failure, 1 skipped), wall-clock 8s, runner time 5s.',
      '',
      '| chain | task | outcome | duration | detail |',
      '| --- | --- | --- | --- | --- |',
      '| lib-a | `lib-a:typecheck` | ❌ failure | 2.5s |  |',
    ])
  })

  it('ends with the timeline', () => {
    expect(runSummary(RUN, PLAN).slice(-1)).toEqual(['```'])
  })
})
