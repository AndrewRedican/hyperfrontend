import type { ChainChecks } from './checks'
import type { EnvironmentRunOptions } from './environment'
import type { RunOutcome } from './execute'
import type { Origin, Plan, PlanTask, RunResults } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { runEnvironmentPlan } from './environment'

/** Where the inherited tasks of a case ran. */
const ORIGIN: Origin = { run: 7, attempt: 1, sha: 'abcdef0123456789', url: null, tree: '0123456789abcdef', node: 'v24.18.0', endedAt: 1000 }

/**
 * A task.
 *
 * @param id - `<project>:<target>`
 * @param needs - The tasks it needs first
 * @returns A light task of Linux
 */
function task(id: string, ...needs: string[]): PlanTask {
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
  }
}

/** A library type checked and then built, a second one tested, and a chain of another environment. */
const PLAN: Plan = {
  base: 'abc',
  head: null,
  mode: 'affected',
  main: false,
  targets: ['typecheck', 'test', 'build'],
  drift: [],
  chains: [
    { project: 'lib-a', environment: 'linux', order: 0, tasks: [task('lib-a:typecheck'), task('lib-a:build', 'lib-a:typecheck')] },
    { project: 'lib-b', environment: 'linux', order: 1, tasks: [task('lib-b:test')] },
    { project: 'lib-a', environment: 'windows', order: 2, tasks: [{ ...task('lib-a:typecheck'), environment: 'windows' }] },
  ],
  skipped: [],
  environments: ['linux', 'windows'],
  tested: { tree: 'fedcba9876543210', head: null, base: null, merge: null },
}

/** The plan with the type check of the first library and the whole chain of the second inherited. */
const INHERITING: Plan = {
  ...PLAN,
  chains: PLAN.chains.map((chain) => ({
    ...chain,
    tasks: chain.tasks.map((item) => (item.id === 'lib-a:build' || chain.environment !== 'linux' ? item : { ...item, inherited: ORIGIN })),
  })),
}

/** What a run of a case did. */
interface Ran {
  /** The results answered. */
  readonly results: RunResults
  /** What happened, in order: a task started, a results file written, a check-run hook called. */
  readonly events: string[]
  /** The lines of the job's log. */
  readonly lines: string[]
}

/**
 * Runs a plan on Linux, one task at a time, on a clock that stands still.
 *
 * @param plan - The plan run
 * @param outcomes - What a task ends as, by id; a task not named succeeds without a log
 * @param options - How the run differs: no check runs, a folded log, an interruption
 * @returns The results, what happened and what was said
 */
async function ran(
  plan: Plan,
  outcomes: Readonly<Record<string, Partial<RunOutcome>>> = {},
  options: Partial<EnvironmentRunOptions> = {}
): Promise<Ran> {
  const events: string[] = []
  const lines: string[] = []
  const hook =
    (name: string): ChainChecks['onTask'] =>
    async (chain, results) => {
      events.push(
        `${name} ${chain.project}${results.length === 0 ? '' : `: ${results.map((result) => `${result.id} ${result.outcome}`).join(', ')}`}`
      )
    }
  const results = await runEnvironmentPlan({
    plan,
    environment: 'linux',
    parallel: 1,
    heavy: 1,
    run: async (item) => {
      events.push(`run ${item.id} after ${item.needs.join(', ')}`)
      return { outcome: 'success', exitCode: 0, log: null, detail: null, ...outcomes[item.id] }
    },
    readLog: (path) => `first line of ${path}\nlast line\n`,
    checks: {
      onStart: (chain) => hook('onStart')(chain, []),
      onTask: hook('onTask'),
      onEnd: hook('onEnd'),
      onInherited: hook('onInherited'),
    },
    say: (line) => lines.push(line),
    write: (written) =>
      events.push(`write ${written.complete ? 'complete' : 'incomplete'}: ${written.tasks.map((item) => item.id).join(', ')}`),
    grouped: false,
    identity: { id: 8, attempt: 1, sha: 'abc', url: null },
    node: 'v24.18.0',
    now: () => 5000,
    ...options,
  })
  return { results, events, lines }
}

describe('runEnvironmentPlan', () => {
  it("answers the results of this environment's tasks in chain order, with the tree, the run and the Node.js release", async () => {
    const { results } = await ran(PLAN)
    expect({ ...results, tasks: results.tasks.map((item) => `${item.environment} ${item.id} ${item.outcome}`) }).toEqual({
      environment: 'linux',
      base: 'abc',
      head: null,
      mode: 'affected',
      startedAt: 5000,
      endedAt: 5000,
      durationMs: 0,
      complete: true,
      tasks: ['linux lib-a:typecheck success', 'linux lib-a:build success', 'linux lib-b:test success'],
      tested: PLAN.tested,
      run: { id: 8, attempt: 1, sha: 'abc', url: null },
      node: 'v24.18.0',
    })
  })

  it('rewrites the results after every task that ends, and creates, rewrites and completes the check run of each chain', async () => {
    expect((await ran(PLAN)).events).toEqual([
      'onStart lib-a',
      'run lib-a:typecheck after ',
      'write incomplete: lib-a:typecheck',
      'onTask lib-a: lib-a:typecheck success',
      'run lib-a:build after lib-a:typecheck',
      'write incomplete: lib-a:typecheck, lib-a:build',
      'onEnd lib-a: lib-a:typecheck success, lib-a:build success',
      'onStart lib-b',
      'run lib-b:test after ',
      'write incomplete: lib-a:typecheck, lib-a:build, lib-b:test',
      'onEnd lib-b: lib-b:test success',
    ])
  })

  it('says each task as it starts and replays its log under a heading as it ends', async () => {
    const { lines } = await ran(PLAN, {
      'lib-a:typecheck': { log: 'logs/typecheck.log' },
      'lib-a:build': { outcome: 'skipped', detail: 'not now' },
    })
    expect(lines.slice(0, 6)).toEqual([
      '▶ lib-a:typecheck',
      '── lib-a:typecheck (success, 0s)',
      'first line of logs/typecheck.log',
      'last line',
      '▶ lib-a:build',
      '── lib-a:build (skipped, not now, 0s)',
    ])
  })

  it('folds each log and raises an annotation with the excerpt of a failure in a workflow', async () => {
    const { lines } = await ran(PLAN, { 'lib-b:test': { outcome: 'failure', exitCode: 1, log: 'logs/test.log' } }, { grouped: true })
    expect(lines.slice(-5)).toEqual([
      '::group::lib-b:test (failure, 0s)',
      'first line of logs/test.log',
      'last line',
      '::endgroup::',
      '::error title=lib-b%3Atest failed::first line of logs/test.log%0Alast line',
    ])
  })

  it('raises no annotation for a failure that printed nothing', async () => {
    const { lines } = await ran(PLAN, { 'lib-b:test': { outcome: 'failure', exitCode: 1 } }, { grouped: true })
    expect(lines.slice(-2)).toEqual(['::group::lib-b:test (failure, 0s)', '::endgroup::'])
  })

  it('opens and concludes the check run of a chain none of whose tasks started', async () => {
    const controller = new AbortController()
    controller.abort()
    const { events } = await ran(PLAN, {}, { signal: controller.signal })
    expect(events.filter((event) => event.startsWith('on') && event.includes('lib-b'))).toEqual([
      'onStart lib-b',
      'onEnd lib-b: lib-b:test cancelled',
    ])
  })

  it('runs and records the same without check runs', async () => {
    expect((await ran(PLAN, {}, { checks: null })).events).toEqual([
      'run lib-a:typecheck after ',
      'write incomplete: lib-a:typecheck',
      'run lib-a:build after lib-a:typecheck',
      'write incomplete: lib-a:typecheck, lib-a:build',
      'run lib-b:test after ',
      'write incomplete: lib-a:typecheck, lib-a:build, lib-b:test',
    ])
  })
})

describe('runEnvironmentPlan with inherited tasks', () => {
  it('writes the inherited outcomes before anything runs, runs the rest without its needs on them, and counts them in the chain', async () => {
    expect((await ran(INHERITING)).events).toEqual([
      'write incomplete: lib-a:typecheck, lib-b:test',
      'onInherited lib-b: lib-b:test success',
      'onStart lib-a',
      'run lib-a:build after ',
      'write incomplete: lib-a:typecheck, lib-a:build, lib-b:test',
      'onEnd lib-a: lib-a:typecheck success, lib-a:build success',
    ])
  })

  it('records an inherited task as a success that did not run, with its origin', async () => {
    const { results } = await ran(INHERITING)
    expect(results.tasks.map((item) => [item.id, item.outcome, item.startedAt, item.inherited ?? null])).toEqual([
      ['lib-a:typecheck', 'success', null, ORIGIN],
      ['lib-a:build', 'success', 5000, null],
      ['lib-b:test', 'success', null, ORIGIN],
    ])
  })

  it('says nothing of a task that did not run', async () => {
    expect((await ran(INHERITING)).lines).toEqual(['▶ lib-a:build', '── lib-a:build (success, 0s)'])
  })

  it('writes the inherited outcomes first without check runs too', async () => {
    expect((await ran(INHERITING, {}, { checks: null })).events).toEqual([
      'write incomplete: lib-a:typecheck, lib-b:test',
      'run lib-a:build after ',
      'write incomplete: lib-a:typecheck, lib-a:build, lib-b:test',
    ])
  })
})
