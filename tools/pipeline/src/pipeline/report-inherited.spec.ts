import type { Chain, Origin, Plan, PlanTask, RunResults } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { chainTable, inheritedResults, planSummary, runSummary, totalsLine } from './report'

/** Where the inherited tasks of the fixture ran: a workflow run. */
const RUN_ORIGIN: Origin = {
  run: 7,
  attempt: 1,
  sha: 'abcdef0123456789',
  url: 'https://github.com/o/r/actions/runs/7',
  tree: '0123456789abcdef',
  node: 'v24.18.0',
  endedAt: 86400000,
}

/**
 * A task.
 *
 * @param project - The chain's project
 * @param target - Which target of the project
 * @param inherited - Where the task really ran, when it keeps an earlier outcome
 * @returns The task, on Linux, with one reason
 */
function task(project: string, target: string, inherited?: Origin): PlanTask {
  return {
    id: `${project}:${target}`,
    project,
    target,
    environment: 'linux',
    needs: [],
    weight: 'light',
    reasons: [{ rule: 'changed-input', file: `${project}/src/index.ts`, path: [], message: 'the file is an input of the task' }],
    command: [],
    env: {},
    ...(inherited === undefined ? {} : { inherited }),
  }
}

/** A plan of two chains, one of them inherited whole and the other in part. */
const PLAN: Plan = {
  base: 'abcdef0123456789',
  head: null,
  mode: 'affected',
  main: false,
  targets: ['typecheck', 'test'],
  drift: [],
  chains: [
    { project: 'lib-a', environment: 'linux', order: 0, tasks: [task('lib-a', 'typecheck', RUN_ORIGIN), task('lib-a', 'test')] },
    { project: 'lib-b', environment: 'linux', order: 1, tasks: [task('lib-b', 'typecheck', RUN_ORIGIN)] },
  ],
  skipped: [],
  environments: ['linux'],
}

/** The tasks of the plan. */
const TASKS = PLAN.chains.flatMap((chain) => chain.tasks)

/** A run of the plan: the one task that runs succeeded. */
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
    ...inheritedResults(TASKS).slice(0, 1),
    {
      id: 'lib-a:test',
      project: 'lib-a',
      target: 'test',
      environment: 'linux',
      reasons: [],
      outcome: 'success',
      exitCode: 0,
      detail: null,
      startedAt: 1000,
      endedAt: 3500,
      durationMs: 2500,
      log: 'logs/lib-a__test.log',
    },
    ...inheritedResults(TASKS).slice(1),
  ],
}

describe('inheritedResults', () => {
  it('answers a success that did not run for each marked task, naming the run and its head commit', () => {
    expect(inheritedResults(TASKS)).toEqual([
      {
        id: 'lib-a:typecheck',
        project: 'lib-a',
        target: 'typecheck',
        environment: 'linux',
        reasons: (TASKS[0] as PlanTask).reasons,
        outcome: 'success',
        exitCode: null,
        detail: 'inherited from run 7 (abcdef0): nothing it reads changed since',
        startedAt: null,
        endedAt: null,
        durationMs: 0,
        log: null,
        inherited: RUN_ORIGIN,
      },
      expect.objectContaining({ id: 'lib-b:typecheck', inherited: RUN_ORIGIN }),
    ])
  })

  it('names the tree and the end of the task for an outcome of a run on this machine', () => {
    const local: Origin = { ...RUN_ORIGIN, run: null, attempt: null, sha: null, url: null }
    expect(inheritedResults([task('lib-a', 'lint', local)]).map((result) => result.detail)).toEqual([
      'inherited from a local run on tree 0123456 that ended 1970-01-02T00:00:00.000Z: nothing it reads changed since',
    ])
  })
})

describe('planSummary of a plan with inherited tasks', () => {
  it('leads with how much runs and how much inherits, and what the mark means', () => {
    expect(planSummary(PLAN).slice(2, 5)).toEqual([
      'Affected plan (abcdef012345 → working tree): 2 chains (2 linux), 3 tasks.',
      '',
      '1 task runs, 2 inherited from run 7. A task marked ↩️ keeps the outcome of that earlier run.',
    ])
  })

  it('marks the inherited tasks in the table of chains', () => {
    expect(planSummary(PLAN).slice(8, 10)).toEqual([
      '| 0 | lib-a | linux | `typecheck`↩️ `test` |',
      '| 1 | lib-b | linux | `typecheck`↩️ |',
    ])
  })

  it('says where an inherited task comes from before its reasons', () => {
    expect(planSummary(PLAN)).toEqual(
      expect.arrayContaining([
        '  - `lib-a:typecheck`',
        '    - inherited from run 7 (abcdef0): nothing it reads changed since',
        '    - changed-input lib-a/src/index.ts: the file is an input of the task',
      ])
    )
  })
})

describe('totalsLine of a run with inherited tasks', () => {
  it('counts the inherited tasks apart from the ones that ran', () => {
    expect(totalsLine(RUN)).toBe('3 tasks (1 success, 2 inherited), wall-clock 8s, runner time 2.5s.')
  })
})

describe('chainTable of a chain with an inherited task', () => {
  it('shows the task as inherited, with no duration and where it comes from', () => {
    expect(chainTable(PLAN.chains[0] as Chain, RUN.tasks.slice(0, 2)).slice(-2)).toEqual([
      '| `lib-a:typecheck` | ↩️ inherited |  | inherited from run 7 (abcdef0): nothing it reads changed since |',
      '| `lib-a:test` | ✅ success | 2.5s |  |',
    ])
  })
})

describe('runSummary of a run whose tasks are all inherited', () => {
  it('draws no timeline, since no task ran', () => {
    const inherited = { ...RUN, tasks: RUN.tasks.filter((result) => result.inherited !== undefined) }
    expect(runSummary(inherited, PLAN).filter((line) => line.startsWith('```') || line.startsWith('gantt'))).toEqual([])
  })
})

describe('runSummary of a run with inherited tasks', () => {
  it('draws a bar for the task that ran alone', () => {
    expect(runSummary(RUN, PLAN).slice(-4)).toEqual(['  axisFormat %H:%M:%S', '  section lib-a', '  test (2.5s) :done, 1000, 3500', '```'])
  })
})
