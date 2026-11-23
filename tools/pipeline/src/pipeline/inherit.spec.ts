import type { Environment, Origin, Plan, PlanTask, RunResults, TaskResult } from './model'
import { after as afterAll } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createPipelineWorkspace, modified } from './__test-utils__/workspace'
import {
  acceptInheritance,
  declineInheritance,
  inheritanceLine,
  inheritedFrom,
  inheritPlan,
  blocksInheritance,
  originName,
  PROOF_AGE_MS,
  proofsOf,
  scheduledNeeds,
} from './inherit'
import { createPlan } from './plan'

const workspace = createPipelineWorkspace()
const { graph } = workspace

afterAll(() => workspace.remove())

/** The plan of a pull request touching two libraries and the application. */
const FULL = createPlan({
  graph,
  changes: modified('libs/alpha/src/index.ts', 'libs/testing/src/index.ts', 'apps/site/src/main.ts'),
  main: false,
})

/** The plan of a later push that touched the application alone. */
const SINCE_SITE = createPlan({ graph, changes: modified('apps/site/src/main.ts'), main: false })

/** The plan of a later push that touched the private library alone. */
const SINCE_TESTING = createPlan({ graph, changes: modified('libs/testing/src/index.ts'), main: false })

/** The tree the proofs of the fixture stand on. */
const EARLIER_TREE = '0123456789abcdef0123456789abcdef01234567'

/** The head commit of the run the proofs of the fixture come from. */
const HEAD_SHA = 'abcdef0123456789abcdef0123456789abcdef01'

/**
 * Where a proof of the fixture comes from.
 *
 * @param run - The workflow run, or null for a run on this machine
 * @param overrides - What differs from a first attempt on Node.js 24.18.0 that ended at 1000
 * @returns A first attempt of that run on Node.js 24.18.0 that ended at 1000, but for the overrides
 */
function origin(run: number | null, overrides: Partial<Origin> = {}): Origin {
  return {
    run,
    attempt: run === null ? null : 1,
    sha: run === null ? null : HEAD_SHA,
    url: run === null ? null : `https://github.com/o/r/actions/runs/${run}`,
    tree: EARLIER_TREE,
    node: 'v24.18.0',
    endedAt: 1000,
    ...overrides,
  }
}

/**
 * A proof for every task a plan holds on an environment.
 *
 * @param environment - The environment the proofs were recorded on
 * @param without - The ids of the tasks left without one
 * @param from - The origin of each proof
 * @returns The proofs by task id
 */
function proofs(environment: Environment, without: readonly string[] = [], from: Origin = origin(7)): Map<string, Origin> {
  return createMap(
    FULL.chains
      .filter((chain) => chain.environment === environment)
      .flatMap((chain) => chain.tasks)
      .filter((task) => !without.includes(task.id))
      .map((task) => [task.id, from] as const)
  )
}

/**
 * The tasks of a plan that run.
 *
 * @param plan - The plan, marked or not
 * @param environment - The environment listed
 * @returns The ids of the environment's tasks without a mark, in chain order
 */
function running(plan: Plan, environment: Environment): string[] {
  return plan.chains
    .filter((chain) => chain.environment === environment)
    .flatMap((chain) => chain.tasks)
    .filter((task) => task.inherited === undefined)
    .map((task) => task.id)
}

/**
 * How many tasks of a plan inherit, per environment.
 *
 * @param plan - The plan, marked or not
 * @returns The count of marked tasks of each environment
 */
function inherited(plan: Plan): Record<string, number> {
  const counts: Record<string, number> = { linux: 0, windows: 0, macos: 0 }
  for (const task of plan.chains.flatMap((chain) => chain.tasks)) if (task.inherited !== undefined) counts[task.environment] += 1
  return counts
}

/**
 * A result of a results file.
 *
 * @param id - The task id
 * @param overrides - What differs from a success that ended at 5000
 * @returns A success on Linux that ended at 5000, but for the overrides
 */
function result(id: string, overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    id,
    project: id.slice(0, id.indexOf(':')),
    target: id.slice(id.indexOf(':') + 1),
    environment: 'linux',
    reasons: [],
    outcome: 'success',
    exitCode: 0,
    detail: null,
    startedAt: 4000,
    endedAt: 5000,
    durationMs: 1000,
    log: null,
    ...overrides,
  }
}

/** The results file of a workflow run on Linux. */
const RESULTS: RunResults = {
  environment: 'linux',
  base: 'base',
  head: null,
  mode: 'affected',
  startedAt: 0,
  endedAt: 9000,
  durationMs: 9000,
  complete: true,
  tasks: [result('lib-a:test')],
  tested: { tree: EARLIER_TREE, head: HEAD_SHA, base: null, merge: null },
  run: { id: 7, attempt: 2, sha: HEAD_SHA, url: 'https://github.com/o/r/actions/runs/7' },
  node: 'v24.18.0',
}

describe('blocksInheritance', () => {
  it('counts the files that decide what a task runs or what a recorded success means', () => {
    expect(
      [
        'tools/pipeline/bin/pipeline.ts',
        'tools/pipeline/scripts/probe-node-floor.mjs',
        'tools/pipeline/src/pipeline/report.ts',
        'tools/pipeline/src/pipeline/deep/module.ts',
        'libs/workspace/bin/hf.mjs',
        'libs/workspace/src/bin/hf.ts',
      ].filter((path) => !blocksInheritance(path))
    ).toEqual([])
  })

  it('counts the files that decide how an environment is checked out, installed and started', () => {
    expect(
      [
        '.github/workflows/ci-pr.yml',
        '.github/actions/setup-monorepo/action.yml',
        '.github/actions/version-check/action.yml',
        '.npmrc',
        '.nvmrc',
        '.gitattributes',
      ].filter((path) => !blocksInheritance(path))
    ).toEqual([])
  })

  it('leaves out the specs, the test utilities and every other file', () => {
    expect(
      [
        'tools/pipeline/src/pipeline/report.spec.ts',
        'tools/pipeline/src/pipeline/__test-utils__/workspace.ts',
        'libs/workspace/src/bin/hf.spec.ts',
        'tools/pipeline/bin/types-extract.ts',
        'tools/pipeline/scripts/audit.mjs',
        'tools/pipeline/src/types-extract/extract.ts',
        'tools/pipeline/README.md',
        'libs/workspace/src/graph/changes.ts',
        'libs/workspace/bin/package.json',
        '.github/workflows/ci-main.yml',
        '.github/workflows/cla.yml',
        'libs/alpha/.npmrc',
      ].filter(blocksInheritance)
    ).toEqual([])
  })
})

describe('proofsOf', () => {
  it('offers each success with the run, the tree and the Node.js release of the file and the end of the task', () => {
    expect([...proofsOf(RESULTS, 6000)]).toEqual([
      [
        'lib-a:test',
        {
          run: 7,
          attempt: 2,
          sha: HEAD_SHA,
          url: 'https://github.com/o/r/actions/runs/7',
          tree: EARLIER_TREE,
          node: 'v24.18.0',
          endedAt: 5000,
        },
      ],
    ])
  })

  it('names no run for a results file written on this machine', () => {
    expect(proofsOf({ ...RESULTS, run: null }, 6000).get('lib-a:test')).toEqual(origin(null, { endedAt: 5000 }))
  })

  it('offers no task that failed, was skipped or was cancelled', () => {
    const tasks = [
      result('lib-a:lint', { outcome: 'failure' }),
      result('lib-a:build', { outcome: 'skipped' }),
      result('lib-a:e2e', { outcome: 'cancelled' }),
    ]
    expect([...proofsOf({ ...RESULTS, tasks }, 6000).keys()]).toEqual([])
  })

  it('keeps the first origin and the first end of a success that was itself inherited', () => {
    const first = origin(3, { endedAt: 100 })
    const tasks = [result('lib-a:test', { startedAt: null, endedAt: null, durationMs: 0, exitCode: null, inherited: first })]
    expect(proofsOf({ ...RESULTS, tasks }, 6000).get('lib-a:test')).toBe(first)
  })

  it('offers nothing past seven days from the end of the task, however recently a run passed it along', () => {
    const tasks = [
      result('lib-a:lint', { endedAt: 5000 }),
      result('lib-a:test', { endedAt: 5001 }),
      result('lib-a:build', { endedAt: null, inherited: origin(3, { endedAt: 5000 }) }),
    ]
    expect([...proofsOf({ ...RESULTS, tasks }, 5000 + PROOF_AGE_MS).keys()]).toEqual(['lib-a:test'])
  })

  it('offers no success that names neither an end nor an origin', () => {
    expect(proofsOf({ ...RESULTS, tasks: [result('lib-a:test', { endedAt: null })] }, 6000).size).toBe(0)
  })

  it('offers no success whose origin is not shaped like one, whether a task carries it or the file composes it', () => {
    const carried: Record<string, unknown>[] = [
      { run: '7\n::error::x' },
      { run: 7.5 },
      { run: null },
      { attempt: null },
      { attempt: '1' },
      { sha: 5 },
      { sha: 'main' },
      { url: 5 },
      { url: 'https://github.com/o/r\n::error::x' },
      { tree: 'not a tree' },
      { node: 24 },
      { node: 'v24.18.0\n::error::x' },
      { endedAt: '1000' },
      { endedAt: Number.POSITIVE_INFINITY },
    ]
    const tasks = carried.map((fields, index) => result(`lib-a:carried-${index}`, { inherited: { ...origin(7), ...fields } as Origin }))
    const composed = [
      { ...RESULTS, run: { ...RESULTS.run, sha: 5 } },
      { ...RESULTS, run: { ...RESULTS.run, id: '7' } },
      { ...RESULTS, node: 'latest' },
      { ...RESULTS, tested: { ...RESULTS.tested, tree: '--upload-pack=x' } },
    ] as unknown as RunResults[]
    expect([...proofsOf({ ...RESULTS, tasks }, 6000).keys(), ...composed.flatMap((file) => [...proofsOf(file, 6000).keys()])]).toEqual([])
  })

  it('offers a success whose origin names a run on this machine, with no run, attempt, head commit or page', () => {
    const local = origin(null)
    expect(proofsOf({ ...RESULTS, tasks: [result('lib-a:test', { endedAt: null, inherited: local })] }, 6000).get('lib-a:test')).toBe(local)
  })

  it('offers nothing from a file that names no tested tree', () => {
    expect(proofsOf({ ...RESULTS, tested: undefined }, 6000).size).toBe(0)
  })

  it('offers nothing from a file that names no Node.js release', () => {
    expect(proofsOf({ ...RESULTS, node: undefined }, 6000).size).toBe(0)
  })
})

describe('inheritPlan', () => {
  it('answers the full plan unchanged without a source', () => {
    expect(inheritPlan({ full: FULL, sources: [] })).toEqual(FULL)
  })

  it('runs every task the change since the proofs selects and inherits the rest of the environment', () => {
    const plan = inheritPlan({ full: FULL, sources: [{ environment: 'linux', since: SINCE_SITE, proofs: proofs('linux') }] })
    expect(running(plan, 'linux')).toEqual(['app-site:typecheck', 'app-site:lint', 'app-site:build'])
  })

  it('covers no other environment with the proofs of one', () => {
    const plan = inheritPlan({ full: FULL, sources: [{ environment: 'linux', since: SINCE_SITE, proofs: proofs('linux') }] })
    expect(inherited(plan)).toEqual({ linux: 17, windows: 0, macos: 0 })
  })

  it('runs a task without a proof and every task it needs, transitively', () => {
    const plan = inheritPlan({
      full: FULL,
      sources: [{ environment: 'linux', since: SINCE_SITE, proofs: proofs('linux', ['e2e-alpha:e2e']) }],
    })
    expect(running(plan, 'linux')).toEqual([
      'lib-alpha:typecheck',
      'lib-alpha:build',
      'e2e-alpha:e2e',
      'app-site:typecheck',
      'app-site:lint',
      'app-site:build',
    ])
  })

  it('runs everything of an environment whose source proves nothing', () => {
    const plan = inheritPlan({ full: FULL, sources: [{ environment: 'macos', since: SINCE_SITE, proofs: createMap() }] })
    expect(inherited(plan)).toEqual({ linux: 0, windows: 0, macos: 0 })
  })

  it('applies to each environment its own change and its own proofs', () => {
    const plan = inheritPlan({
      full: FULL,
      sources: [
        { environment: 'linux', since: SINCE_SITE, proofs: proofs('linux') },
        { environment: 'windows', since: SINCE_TESTING, proofs: proofs('windows') },
      ],
    })
    expect(running(plan, 'windows')).toEqual([
      'lib-alpha:build',
      'e2e-alpha:e2e',
      'lib-alpha:smoke-floor',
      'lib-alpha:smoke-major',
      'lib-testing:typecheck',
      'lib-testing:lint',
      'lib-testing:test',
      'lib-testing:build',
    ])
  })

  it('ignores a task the change since the proofs selects and the full plan does not hold', () => {
    const since = createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: false })
    const plan = inheritPlan({ full: FULL, sources: [{ environment: 'linux', since, proofs: proofs('linux') }] })
    expect(running(plan, 'linux')).toEqual([
      'lib-beta:typecheck',
      'lib-beta:test',
      'lib-beta:build',
      'e2e-beta:e2e',
      'lib-beta:probe',
      'app-site:typecheck',
      'app-site:build',
    ])
  })

  it('marks an inherited task with the origin of its proof and leaves its needs in place', () => {
    const from = origin(9)
    const plan = inheritPlan({ full: FULL, sources: [{ environment: 'linux', since: SINCE_SITE, proofs: proofs('linux', [], from) }] })
    const build = plan.chains.flatMap((chain) => chain.tasks).find((task) => task.id === 'lib-alpha:build' && task.environment === 'linux')
    expect({ inherited: build?.inherited, needs: build?.needs }).toEqual({ inherited: from, needs: ['lib-alpha:typecheck'] })
  })
})

describe('declineInheritance', () => {
  const marked = inheritPlan({
    full: FULL,
    sources: [
      { environment: 'linux', since: SINCE_SITE, proofs: proofs('linux') },
      { environment: 'windows', since: SINCE_SITE, proofs: proofs('windows') },
    ],
  })

  it('clears the marks of the environment and leaves those of the others', () => {
    expect(inherited(declineInheritance(marked, 'linux'))).toEqual({ linux: 0, windows: 15, macos: 0 })
  })

  it('restores the full plan once every environment declined', () => {
    expect(declineInheritance(declineInheritance(marked, 'linux'), 'windows')).toEqual(FULL)
  })
})

describe('scheduledNeeds', () => {
  it('leaves out the inherited tasks and every need on one', () => {
    const tasks = inheritPlan({ full: FULL, sources: [{ environment: 'linux', since: SINCE_TESTING, proofs: proofs('linux') }] })
      .chains.filter((chain) => chain.environment === 'linux' && chain.project === 'lib-alpha')
      .flatMap((chain) => chain.tasks)
    expect(scheduledNeeds(tasks).map((task: PlanTask) => `${task.id} after ${task.needs.join(', ')}`)).toEqual([
      'lib-alpha:build after ',
      'e2e-alpha:e2e after lib-alpha:build',
      'lib-alpha:probe after lib-alpha:build',
      'lib-alpha:smoke-floor after lib-alpha:build',
      'lib-alpha:smoke-major after lib-alpha:build',
    ])
  })
})

describe('acceptInheritance', () => {
  const marked = inheritPlan({
    full: FULL,
    sources: [
      { environment: 'linux', since: SINCE_SITE, proofs: proofs('linux', [], origin(7, { node: 'v24.18.0' })) },
      { environment: 'windows', since: SINCE_SITE, proofs: proofs('windows', [], origin(7, { node: 'v24.17.0' })) },
    ],
  })

  it('answers the plan itself, saying nothing, when every inherited task of the environment ran on the release', () => {
    const lines: string[] = []
    expect({
      same: acceptInheritance(marked, 'linux', { node: 'v24.18.0', off: false }, (line) => lines.push(line)) === marked,
      lines,
    }).toEqual({
      same: true,
      lines: [],
    })
  })

  it('clears the marks of an environment whose inherited tasks ran on another release, and leaves the others', () => {
    expect(inherited(acceptInheritance(marked, 'windows', { node: 'v24.18.0', off: false }, () => undefined))).toEqual({
      linux: 17,
      windows: 0,
      macos: 0,
    })
  })

  it('says which release the proofs are from, once', () => {
    const lines: string[] = []
    acceptInheritance(marked, 'windows', { node: 'v24.18.0', off: false }, (line) => lines.push(line))
    expect(lines).toEqual(['nothing is inherited on windows: its proofs are from Node.js v24.17.0 and this run is on v24.18.0'])
  })

  it('clears the marks of the environment and says so when every task was asked to run', () => {
    const lines: string[] = []
    const plan = acceptInheritance(marked, 'linux', { node: 'v24.18.0', off: true }, (line) => lines.push(line))
    expect({ inherited: inherited(plan), lines }).toEqual({
      inherited: { linux: 0, windows: 15, macos: 0 },
      lines: ['nothing is inherited on linux: every task was asked to run'],
    })
  })

  it('says nothing of an environment that holds no mark, whatever was asked', () => {
    const lines: string[] = []
    expect({
      same: acceptInheritance(marked, 'macos', { node: 'v0.0.1', off: true }, (line) => lines.push(line)) === marked,
      lines,
    }).toEqual({
      same: true,
      lines: [],
    })
  })
})

describe('originName', () => {
  it('names a workflow run by its id', () => {
    expect(originName(origin(45062206244))).toBe('run 45062206244')
  })

  it('names a run on this machine by the tree it stood on', () => {
    expect(originName(origin(null))).toBe('a local run on tree 0123456')
  })
})

describe('inheritedFrom', () => {
  it('names the one run every origin shares', () => {
    expect(inheritedFrom([origin(7, { endedAt: 1 }), origin(7, { endedAt: 2 })])).toBe('run 7')
  })

  it('counts the runs when the origins differ', () => {
    expect(inheritedFrom([origin(7), origin(8), origin(8), origin(null)])).toBe('3 runs')
  })
})

describe('inheritanceLine', () => {
  it('answers null for a plan no task of which inherits', () => {
    expect(inheritanceLine(FULL)).toBeNull()
  })

  it('counts the tasks that run and the tasks that inherit, naming the run', () => {
    const plan = inheritPlan({ full: FULL, sources: [{ environment: 'linux', since: SINCE_SITE, proofs: proofs('linux') }] })
    expect(inheritanceLine(plan)).toBe('33 tasks run, 17 inherited from run 7')
  })

  it('says so when a single task runs', () => {
    const plan = inheritPlan({
      full: SINCE_SITE,
      sources: [{ environment: 'linux', since: { ...SINCE_SITE, chains: [] }, proofs: proofs('linux', ['app-site:lint']) }],
    })
    expect(inheritanceLine(plan)).toBe('1 task runs, 2 inherited from run 7')
  })
})
