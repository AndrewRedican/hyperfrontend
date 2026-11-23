import type { RunOutcome } from './execute'
import type { LocalRunOptions, LocalTask } from './local'
import type { Origin, Plan, RunResults } from './model'
import type { ScheduleResult } from './schedule'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTerminal } from '@hyperfrontend/workspace/progress'
import { runLocal, runLocalPlan } from './local'

/** A local run of a case, with what it wrote and what it ran. */
interface Ran {
  /** Every task's result, by id. */
  readonly results: Map<string, ScheduleResult>
  /** The lines written, without the durations a clock that stands still makes `0s`. */
  readonly lines: string[]
  /** The ids of the tasks that ran, in the order they started. */
  readonly started: string[]
  /** The logs read for an excerpt. */
  readonly read: string[]
}

/**
 * A task of the Linux environment.
 *
 * @param id - `<project>:<target>`
 * @param needs - The tasks it needs first
 * @returns A light task of rank 0
 */
function task(id: string, ...needs: string[]): LocalTask {
  return {
    id,
    project: id.slice(0, id.indexOf(':')),
    target: id.slice(id.indexOf(':') + 1),
    environment: 'linux',
    needs,
    weight: 'light',
    reasons: [],
    command: ['node', id],
    env: {},
    order: 0,
  }
}

/** A library checked, tested and built, and an application whose type check waits on an install. */
const TASKS: readonly LocalTask[] = [
  task('lib:build', 'lib:typecheck'),
  task('lib:test'),
  task('lib:typecheck'),
  task('lib:lint'),
  task('app:install'),
  task('app:typecheck', 'app:install'),
  task('lib:probe', 'lib:build'),
]

/**
 * Runs the tasks of a case locally, one at a time.
 *
 * @param outcomes - What a task ends as, by id; a task not named succeeds without a log
 * @param options - How the run differs from the fixture's
 * @returns The results, what was written, and what ran
 */
async function ran(
  outcomes: Readonly<Record<string, Partial<RunOutcome>>> = {},
  options: Partial<LocalRunOptions<LocalTask>> = {}
): Promise<Ran> {
  const written: string[] = []
  const started: string[] = []
  const read: string[] = []
  const results = await runLocal({
    tasks: TASKS,
    parallel: 1,
    heavy: 1,
    run: async (item) => {
      started.push(item.id)
      return { outcome: 'success', exitCode: 0, log: null, detail: null, ...outcomes[item.id] }
    },
    readLog: (path) => {
      read.push(path)
      return 'first\nlast\n'
    },
    terminal: createTerminal({ write: (text) => written.push(text) }, {}),
    now: () => 0,
    ...options,
  })
  return { results, lines: written.join('').replace(/\n$/, '').split(/\r?\n/), started, read }
}

/**
 * The outcome and the detail of each result.
 *
 * @param results - Every task's result, by id
 * @returns `<id> <outcome>`, then the detail when there is one, in the order of the tasks
 */
function outcomesOf(results: Map<string, ScheduleResult>): string[] {
  return TASKS.map((item) => results.get(item.id) as ScheduleResult).map((result) =>
    [result.id, result.outcome, ...(result.detail === null ? [] : [result.detail])].join(' ')
  )
}

describe('runLocal', () => {
  it('says so when the plan holds no task of this environment', async () => {
    expect(await ran({}, { tasks: [] })).toEqual({ results: createMap(), lines: ['Nothing to run.'], started: [], read: [] })
  })

  it('runs the checks, then the tests, then the rest, with a prerequisite in the stage that first needs it', async () => {
    expect((await ran()).started).toEqual([
      'app:install',
      'app:typecheck',
      'lib:lint',
      'lib:typecheck',
      'lib:test',
      'lib:build',
      'lib:probe',
    ])
  })

  it('answers a result per task when every stage succeeds', async () => {
    expect(outcomesOf((await ran()).results)).toEqual(TASKS.map((item) => `${item.id} success`))
  })

  it('writes a line per stage and per task, then the matrix and the totals', async () => {
    expect((await ran()).lines).toEqual([
      'stage 1 of 3: typecheck, lint, install (4 tasks)',
      '✓ app:install  0s  [1/7]',
      '✓ app:typecheck  0s  [2/7]',
      '✓ lib:lint  0s  [3/7]',
      '✓ lib:typecheck  0s  [4/7]',
      'stage 2 of 3: test (1 task)',
      '✓ lib:test  0s  [5/7]',
      'stage 3 of 3: build, probe (2 tasks)',
      '✓ lib:build  0s  [6/7]',
      '✓ lib:probe  0s  [7/7]',
      '',
      '     typecheck  lint  install  test  build  probe',
      'app  ✓                ✓',
      'lib  ✓          ✓              ✓     ✓      ✓',
      '✓ passed  ✗ failed  - skipped  · not run',
      '',
      '7 tasks in 0s: 7 passed',
    ])
  })

  it('ends the run after a stage with a failure, having run the rest of that stage', async () => {
    const { started } = await ran({ 'lib:typecheck': { outcome: 'failure', exitCode: 2 } })
    expect(started).toEqual(['app:install', 'app:typecheck', 'lib:lint', 'lib:typecheck'])
  })

  it('answers the tasks of the stages that never started as skipped, naming the stage that ended the run', async () => {
    const { results } = await ran({ 'lib:typecheck': { outcome: 'failure', exitCode: 2 } })
    expect(outcomesOf(results)).toEqual([
      'lib:build skipped stage-failed: stage 1',
      'lib:test skipped stage-failed: stage 1',
      'lib:typecheck failure',
      'lib:lint success',
      'app:install success',
      'app:typecheck success',
      'lib:probe skipped stage-failed: stage 1',
    ])
  })

  it('shows the excerpt of a failed task and its log in place of the log, and every later cell as not run', async () => {
    const { lines } = await ran({ 'lib:typecheck': { outcome: 'failure', exitCode: 2, log: '.hf/pipeline/logs/lib__typecheck.log' } })
    expect(lines.slice(4, 13)).toEqual([
      '✗ lib:typecheck  0s  [4/7]',
      '    first',
      '    last',
      '    log: .hf/pipeline/logs/lib__typecheck.log',
      'stage 1 (typecheck, lint, install) did not succeed: 3 tasks not run',
      '',
      '     typecheck  lint  install  test  build  probe',
      'app  ✓                ✓',
      'lib  ✗          ✓              ·     ·      ·',
    ])
  })

  it('reads the log of a failed task alone', async () => {
    const { read } = await ran({
      'lib:typecheck': { outcome: 'failure', log: 'failed.log' },
      'lib:lint': { log: 'passed.log' },
      'app:install': { outcome: 'failure' },
    })
    expect(read).toEqual(['failed.log'])
  })

  it('shows a task skipped after a failed prerequisite of its own stage with the reason', async () => {
    const { lines } = await ran({ 'app:install': { outcome: 'failure' } })
    expect(lines).toContain('- app:typecheck  prerequisite-failed: app:install  [2/7]')
  })

  it('writes no line for the tasks an interruption kept from starting, and shows them as not run', async () => {
    const controller = new AbortController()
    controller.abort()
    const { lines, started } = await ran({}, { signal: controller.signal })
    expect({ lines: [lines[0], lines[1], lines.at(-1)], started }).toEqual({
      lines: [
        'stage 1 of 3: typecheck, lint, install (4 tasks)',
        'stage 1 (typecheck, lint, install) did not succeed: 7 tasks not run',
        '7 tasks in 0s: 7 not run',
      ],
      started: [],
    })
  })
})

describe('runLocalPlan', () => {
  const plan: Plan = {
    base: 'abc',
    head: null,
    mode: 'affected',
    main: false,
    targets: ['lint'],
    drift: [],
    chains: [
      { project: 'lib', environment: 'linux', order: 2, tasks: [task('lib:lint')] },
      { project: 'lib', environment: 'windows', order: 3, tasks: [{ ...task('lib:typecheck'), environment: 'windows' }] },
    ],
    skipped: [],
    environments: ['linux', 'windows'],
  }

  /**
   * Runs the plan of the fixture on Linux, on a clock that moves a second each time it is read.
   *
   * @param outcome - What the lint ends as
   * @returns The results and the lines written
   */
  async function ranPlan(outcome: 'success' | 'failure'): Promise<unknown> {
    const written: string[] = []
    let at = 0
    const results = await runLocalPlan({
      plan,
      environment: 'linux',
      parallel: 1,
      heavy: 1,
      run: async () => ({ outcome, exitCode: 0, log: 'lint.log', detail: null }),
      readLog: () => 'a finding\n',
      terminal: createTerminal({ write: (text) => written.push(text) }, {}),
      now: () => (at += 1000),
      node: 'v24.18.0',
    })
    return { results, first: written[0] }
  }

  it('heads the run with the plan in one sentence', async () => {
    expect(await ranPlan('success')).toEqual(
      expect.objectContaining({ first: 'Affected plan (abc → working tree): 2 chains (1 linux, 1 windows), 2 tasks.\n' })
    )
  })

  it("answers the results of this environment's tasks alone, with the times of the run and the excerpt of a failure", async () => {
    expect(await ranPlan('failure')).toEqual(
      expect.objectContaining({
        results: {
          environment: 'linux',
          base: 'abc',
          head: null,
          mode: 'affected',
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
          durationMs: expect.any(Number),
          complete: true,
          tasks: [expect.objectContaining({ id: 'lib:lint', outcome: 'failure', excerpt: 'a finding' })],
          tested: undefined,
          run: null,
          node: 'v24.18.0',
          local: true,
        },
      })
    )
  })
})

describe('runLocalPlan with inherited tasks', () => {
  const origin: Origin = { run: null, attempt: null, sha: null, url: null, tree: '0123456789abcdef', node: 'v24.18.0', endedAt: 1000 }
  const tested = { tree: 'fedcba9876543210', head: null, base: null, merge: null }
  const plan: Plan = {
    base: 'abc',
    head: null,
    mode: 'affected',
    main: false,
    targets: ['typecheck', 'build'],
    drift: [],
    chains: [
      {
        project: 'lib',
        environment: 'linux',
        order: 0,
        tasks: [
          { ...task('lib:typecheck'), inherited: origin },
          task('lib:build', 'lib:typecheck'),
          { ...task('lib:lint'), inherited: origin },
        ],
      },
    ],
    skipped: [],
    environments: ['linux'],
    tested,
  }

  /**
   * Runs a plan on Linux, every task that runs succeeding.
   *
   * @param planned - The plan run
   * @returns The results, the lines written and the ids of the tasks that ran
   */
  async function ranInherited(planned: Plan): Promise<{ results: RunResults; lines: string[]; started: string[] }> {
    const written: string[] = []
    const started: string[] = []
    const results = await runLocalPlan({
      plan: planned,
      environment: 'linux',
      parallel: 1,
      heavy: 1,
      run: async (item) => {
        started.push(item.id)
        return { outcome: 'success', exitCode: 0, log: null, detail: null }
      },
      readLog: () => '',
      terminal: createTerminal({ write: (text) => written.push(text) }, {}),
      now: () => 0,
      node: 'v24.18.0',
    })
    return { results, lines: written.join('').split(/\r?\n/), started }
  }

  it('runs the tasks without a mark alone, a need on an inherited task set aside', async () => {
    expect((await ranInherited(plan)).started).toEqual(['lib:build'])
  })

  it('counts the inherited tasks on one line under the plan, and shows only what runs', async () => {
    expect((await ranInherited(plan)).lines.slice(1, 4)).toEqual([
      '2 tasks inherited from a local run on tree 0123456: nothing they read changed since',
      'stage 3 of 3: build (1 task)',
      '✓ lib:build  0s  [1/1]',
    ])
  })

  it('records every task in chain order, the inherited ones with their origin, on the tree the plan was made on', async () => {
    const { results } = await ranInherited(plan)
    expect({ tested: results.tested, tasks: results.tasks.map((item) => [item.id, item.outcome, item.inherited ?? null]) }).toEqual({
      tested,
      tasks: [
        ['lib:typecheck', 'success', origin],
        ['lib:build', 'success', null],
        ['lib:lint', 'success', origin],
      ],
    })
  })

  it('says nothing is left to run when every task is inherited', async () => {
    const whole = { ...plan, chains: plan.chains.map((chain) => ({ ...chain, tasks: chain.tasks.slice(0, 1) })) }
    expect((await ranInherited(whole)).lines.slice(1, 3)).toEqual([
      '1 task inherited from a local run on tree 0123456: nothing it reads changed since',
      'Nothing to run.',
    ])
  })
})
