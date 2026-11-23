import type { Environment, Origin, Plan, RunResults } from './model'
import type { PreviousSource, TestedPlan } from './previous'
import { execFileSync } from 'node:child_process'
import { after as afterAll } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { baseRecords, buildGraph, changeSet } from '@hyperfrontend/workspace/graph'
import { PIPELINE_WORKSPACE } from './__test-utils__/workspace'
import { createPlan } from './plan'
import { inheritFrom, previousSources, previousTree, sourceAt, sourceOf } from './previous'

/** The fixture's workspace file, as far as a spec rewrites it. */
interface WorkspaceFileFixture {
  /** The defaults of each target. */
  readonly targetDefaults: Readonly<Record<string, unknown>>
}

/** An object id no repository of these specs holds. */
const ABSENT = 'f'.repeat(40)

/** Where the proofs of the fixture come from. */
const ORIGIN: Origin = { run: 7, attempt: 1, sha: 'a'.repeat(40), url: null, tree: 'b'.repeat(40), node: 'v24.18.0', endedAt: 5000 }

/** The results file of a workflow run on Linux, one test succeeded. */
const RESULTS: RunResults = {
  environment: 'linux',
  base: 'base',
  head: null,
  mode: 'affected',
  startedAt: 0,
  endedAt: 9000,
  durationMs: 9000,
  complete: true,
  tasks: [
    {
      id: 'lib-a:test',
      project: 'lib-a',
      target: 'test',
      environment: 'linux',
      reasons: [],
      outcome: 'success',
      exitCode: 0,
      detail: null,
      startedAt: 4000,
      endedAt: 5000,
      durationMs: 1000,
      log: null,
    },
  ],
  tested: { tree: 'b'.repeat(40), head: 'a'.repeat(40), base: 'c'.repeat(40), merge: 'd'.repeat(40) },
  run: { id: 7, attempt: 1, sha: 'a'.repeat(40), url: null },
  node: 'v24.18.0',
}

/**
 * Runs git in a repository, as a fixed identity.
 *
 * @param cwd - The repository
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], { cwd, encoding: 'utf8' }).trim()
}

describe('sourceOf', () => {
  it('reads a results file as the tree it stands on, its proofs and the name of its run', () => {
    expect(sourceOf(RESULTS, 6000)).toEqual({
      environment: 'linux',
      tested: RESULTS.tested,
      proofs: createMap([['lib-a:test', ORIGIN]]),
      name: 'run 7',
      local: false,
    })
  })

  it('names a run on this machine as such, whether the file says null or nothing', () => {
    expect([sourceOf({ ...RESULTS, run: null }, 6000)?.name, sourceOf({ ...RESULTS, run: undefined }, 6000)?.name]).toEqual([
      'the last run on this machine',
      'the last run on this machine',
    ])
  })

  it('names no run by an id that is not a number, and proves nothing from such a file', () => {
    const crafted = { ...RESULTS, run: { ...RESULTS.run, id: '7\n::error::x' } } as unknown as RunResults
    expect({ name: sourceOf(crafted, 6000)?.name, proofs: sourceOf(crafted, 6000)?.proofs.size }).toEqual({
      name: 'the last run on this machine',
      proofs: 0,
    })
  })

  it('says whether the kind of run the hook starts wrote the file', () => {
    expect([sourceOf({ ...RESULTS, run: null, local: true }, 6000)?.local, sourceOf(RESULTS, 6000)?.local]).toEqual([true, false])
  })

  it('answers null for a file that names no tested tree', () => {
    expect(sourceOf({ ...RESULTS, tested: undefined }, 6000)).toBeNull()
  })

  it('answers null for a file whose tree is not an object id', () => {
    expect(sourceOf({ ...RESULTS, tested: { tree: '--upload-pack=x', head: null, base: null, merge: null } }, 6000)).toBeNull()
  })

  it('keeps no commit that is not an object id', () => {
    const tested = { tree: 'b'.repeat(40), head: '--upload-pack=x', base: 'main', merge: 7 as unknown as string }
    expect(sourceOf({ ...RESULTS, tested }, 6000)?.tested).toEqual({ tree: 'b'.repeat(40), head: null, base: null, merge: null })
  })
})

describe('previousSources', () => {
  const directory = createTempDir({
    prefix: 'pipeline-previous-',
    tree: {
      'linux/results-linux.json': { ...RESULTS, environment: 'windows' },
      'linux/logs/lib-a__test.log': 'ran\n',
      'windows/results-windows.json': '{ "environment": "windows", "tasks": [',
    },
  })
  const untested = createTempDir({ prefix: 'pipeline-previous-', tree: { 'macos/results-macos.json': { ...RESULTS, tested: undefined } } })
  afterAll(() => {
    directory.remove()
    untested.remove()
  })

  it('reads the file of each environment that left one, under the environment its place names, and passes over a file cut short', () => {
    expect(previousSources(directory.path, 6000).map((source) => [source.environment, source.name, [...source.proofs.keys()]])).toEqual([
      ['linux', 'run 7', ['lib-a:test']],
    ])
  })

  it('passes over a file that names no tested tree', () => {
    expect(previousSources(untested.path, 6000)).toEqual([])
  })

  it('reads one results file as the source of the environment asked for', () => {
    expect(sourceAt(directory.resolve('linux', 'results-linux.json'), 'macos', 6000)).toEqual(
      expect.objectContaining({ environment: 'macos', name: 'run 7' })
    )
  })

  it('answers null for a results file that is absent or cut short', () => {
    expect([
      sourceAt(directory.resolve('macos', 'results-macos.json'), 'macos', 6000),
      sourceAt(directory.resolve('windows', 'results-windows.json'), 'windows', 6000),
    ]).toEqual([null, null])
  })
})

describe('previousTree', () => {
  const remote = createTempDir({ prefix: 'pipeline-remote-', tree: { 'a.txt': 'a\n' } })
  git(remote.path, 'init', '-q', '-b', 'main')
  // why: a commit no ref points at is fetched by id below, which a machine configured for an older git protocol refuses unless the remote allows it
  git(remote.path, 'config', 'uploadpack.allowAnySHA1InWant', 'true')
  git(remote.path, 'add', '-A')
  git(remote.path, 'commit', '-q', '-m', 'base')
  const clone = createTempDir({ prefix: 'pipeline-clone-' })
  git(clone.path, 'clone', '-q', remote.path, '.')
  const start = git(remote.path, 'rev-parse', 'HEAD')
  remote.write('b.txt', 'b\n')
  git(remote.path, 'add', '-A')
  git(remote.path, 'commit', '-q', '-m', 'the base branch moved')
  const base = git(remote.path, 'rev-parse', 'HEAD')
  git(remote.path, 'checkout', '-q', '-b', 'topic', start)
  remote.write('c.txt', 'c\n')
  git(remote.path, 'add', '-A')
  git(remote.path, 'commit', '-q', '-m', 'the pull request')
  const head = git(remote.path, 'rev-parse', 'HEAD')
  git(remote.path, 'checkout', '-q', 'main')
  git(remote.path, 'merge', '-q', '--no-ff', '-m', 'merge', 'topic')
  const merge = git(remote.path, 'rev-parse', 'HEAD')
  const merged = git(remote.path, 'rev-parse', 'HEAD^{tree}')
  const clones = [remote, clone]
  afterAll(() => clones.forEach((directory) => directory.remove()))

  /**
   * A fresh clone of the remote as it was before the base branch moved and the pull request was opened.
   *
   * @returns The clone, removed with the others
   */
  function early(): string {
    const directory = createTempDir({ prefix: 'pipeline-clone-' })
    git(directory.path, 'clone', '-q', clone.path, '.')
    git(directory.path, 'remote', 'set-url', 'origin', remote.path)
    clones.push(directory)
    return directory.path
  }

  it('answers a tree the clone already holds', () => {
    expect(previousTree(remote.path, { tree: merged, head: null, base: null, merge: null })).toBe(merged)
  })

  it('fetches the recorded head and base and rebuilds the tree by merging them', () => {
    expect(previousTree(early(), { tree: merged, head, base, merge: null })).toBe(merged)
  })

  it('reads the tree off the recorded merge commit when the head and the base give another tree', () => {
    expect(previousTree(early(), { tree: merged, head: start, base: start, merge })).toBe(merged)
  })

  it('reads the tree off the recorded merge commit when no head or base is recorded', () => {
    expect(previousTree(early(), { tree: merged, head: null, base, merge })).toBe(merged)
  })

  it('answers null when the tree is rebuilt as another and no merge commit is recorded', () => {
    expect(previousTree(early(), { tree: merged, head: start, base, merge: null })).toBeNull()
  })

  it('answers null when the recorded commits can be fetched from nowhere', () => {
    expect(previousTree(early(), { tree: ABSENT, head: ABSENT, base: ABSENT, merge: ABSENT })).toBeNull()
  })

  it('answers null for a tree the clone lacks and no commit names', () => {
    expect(previousTree(early(), { tree: merged, head: null, base: null, merge: null })).toBeNull()
  })
})

describe('inheritFrom', () => {
  // why: building a graph writes its import cache under node_modules, which a later commit of the fixture must leave out
  const fixture = createTempDir({ prefix: 'pipeline-inherit-', tree: { ...PIPELINE_WORKSPACE, '.gitignore': 'node_modules\n' } })
  afterAll(() => fixture.remove())
  const { path: root } = fixture

  /** One push to the pull request of the fixture. */
  interface Push {
    /** The commit pushed. */
    readonly commit: string
    /** The tree of that commit. */
    readonly tree: string
  }

  /**
   * Commits the working tree of the fixture as a push.
   *
   * @param message - What the commit says it is
   * @returns The commit and its tree
   */
  function commit(message: string): Push {
    git(root, 'add', '-A')
    git(root, 'commit', '-q', '-m', message)
    return { commit: git(root, 'rev-parse', 'HEAD'), tree: git(root, 'rev-parse', 'HEAD^{tree}') }
  }

  git(root, 'init', '-q', '-b', 'main')
  const base = commit('base')
  fixture.write('libs/alpha/src/index.ts', 'export const alpha = 2\n')
  fixture.write('apps/site/src/main.ts', "import { beta } from '@fixture/beta'\nexport const site = beta + 1\n")
  const first = commit('the first push: a library and the application')
  fixture.write('apps/site/src/main.ts', "import { beta } from '@fixture/beta'\nexport const site = beta + 2\n")
  const second = commit('the second push: the application alone')
  fixture.write('tools/pipeline/src/pipeline/report.ts', 'export const report = 1\n')
  const third = commit('the third push: one of the files of the pipeline')
  git(root, 'mv', 'tools/pipeline/src/pipeline/report.ts', 'tools/pipeline/notes.ts')
  const fourth = commit('the fourth push: the file moved out of the pipeline')
  git(root, 'mv', 'libs/alpha/src/index.spec.ts', 'libs/alpha/src/alpha.spec.ts')
  const fifth = commit('the fifth push: a spec renamed')
  fixture.write('.github/actions/setup-monorepo/action.yml', 'runs:\n  using: composite\n')
  const sixth = commit('the sixth push: the action that sets every environment up')
  const graph = buildGraph(root)
  const workspaceFile = fixture.readJson<WorkspaceFileFixture>('hf.json')
  const lintInputs = { lint: { inputs: ['default', '{workspaceRoot}/lint.base.config.ts', '{workspaceRoot}/README.md'] } }
  fixture.write('hf.json', { ...workspaceFile, targetDefaults: { ...workspaceFile.targetDefaults, ...lintInputs } })
  const seventh = commit('the seventh push: the workspace file gives the lints one more input')
  const graphAfter = buildGraph(root)
  git(root, 'rm', '-q', '-r', 'libs/beta')
  const eighth = commit('the eighth push: a library other projects read is removed whole')
  const graphWithout = buildGraph(root)

  /**
   * The plan of the pull request as it stood at one of its pushes.
   *
   * @param push - The push the plan is of
   * @returns The plan from the base to the push, made on the tree of the push
   */
  function fullAt(push: Push): TestedPlan {
    const changes = changeSet(root, base.commit, push.commit)
    return {
      ...createPlan({ graph, changes, main: false, ...baseRecords(root, changes) }),
      tested: { tree: push.tree, head: null, base: null, merge: null },
    }
  }

  /**
   * A source proving every task a plan holds on an environment.
   *
   * @param plan - The plan whose tasks are proven
   * @param environment - Where the proofs were recorded
   * @param tree - The tree the proofs stand on
   * @returns The earlier results of run 7 on that environment
   */
  function source(plan: Plan, environment: Environment, tree: string): PreviousSource {
    const tasks = plan.chains.filter((chain) => chain.environment === environment).flatMap((chain) => chain.tasks)
    return {
      environment,
      tested: { tree, head: null, base: null, merge: null },
      proofs: createMap(tasks.map((task) => [task.id, ORIGIN] as const)),
      name: 'run 7',
      local: false,
    }
  }

  /**
   * Marks a plan from earlier results, collecting the lines reported.
   *
   * @param plan - The plan of the whole change
   * @param previous - The earlier results
   * @param environments - The environments that may inherit, every one of the plan by default
   * @returns The marked plan, the ids of the tasks that run per environment, and the lines
   */
  function inherit(
    plan: TestedPlan,
    previous: readonly PreviousSource[],
    environments?: readonly Environment[]
  ): { plan: Plan; running: Record<string, string[]>; lines: string[] } {
    const lines: string[] = []
    const marked = inheritFrom({ root, graph, plan, previous, environments, report: (line) => lines.push(line) })
    const running: Record<string, string[]> = {}
    for (const task of marked.chains.flatMap((chain) => chain.tasks)) {
      if (task.inherited === undefined) running[task.environment] = [...(running[task.environment] ?? []), task.id]
    }
    return { plan: marked, running, lines }
  }

  it('runs on an environment what the change since its earlier run reaches, and inherits the rest', () => {
    const plan = fullAt(second)
    expect(inherit(plan, [source(plan, 'linux', first.tree)], ['linux']).running['linux']).toEqual([
      'app-site:typecheck',
      'app-site:lint',
      'app-site:build',
    ])
  })

  it('reports nothing when tasks inherit: the summary of the plan says how many', () => {
    const plan = fullAt(second)
    expect(inherit(plan, [source(plan, 'linux', first.tree)], ['linux']).lines).toEqual([])
  })

  it('inherits everything proven when the tree is the one the earlier run stood on', () => {
    const plan = fullAt(second)
    expect(inherit(plan, [source(plan, 'linux', second.tree)], ['linux']).running['linux']).toBeUndefined()
  })

  it('plans a change since that renames a file against the graph of the earlier tree', () => {
    const plan = fullAt(fifth)
    const marked = inherit(plan, [source(plan, 'linux', fourth.tree)], ['linux'])
    expect({ running: marked.running['linux'], lines: marked.lines }).toEqual({
      running: [
        'lib-alpha:typecheck',
        'lib-alpha:lint',
        'lib-alpha:test',
        'lib-alpha:build',
        'e2e-alpha:e2e',
        'lib-alpha:probe',
        'lib-alpha:smoke-floor',
        'lib-alpha:smoke-major',
      ],
      lines: [],
    })
  })

  it('judges a change to the workspace file against the file of the earlier tree, so only the tasks it resolves differently for run', () => {
    const changes = changeSet(root, base.commit, seventh.commit)
    const plan: TestedPlan = {
      ...createPlan({ graph: graphAfter, changes, main: false, ...baseRecords(root, changes) }),
      tested: { tree: seventh.tree, head: null, base: null, merge: null },
    }
    const marked = inheritFrom({
      root,
      graph: graphAfter,
      plan,
      previous: [source(plan, 'linux', sixth.tree)],
      environments: ['linux'],
      report: () => undefined,
    })
    const running = marked.chains
      .flatMap((chain) => chain.tasks)
      .filter((task) => task.environment === 'linux' && task.inherited === undefined)
    expect([...createSet(running.map((task) => task.target))]).toEqual(['lint'])
  })

  it('runs what read a project the change since removed, which only the graph of the earlier tree still knows', () => {
    const changes = changeSet(root, base.commit, eighth.commit)
    const plan: TestedPlan = {
      ...createPlan({ graph: graphWithout, changes, main: false, ...baseRecords(root, changes) }),
      tested: { tree: eighth.tree, head: null, base: null, merge: null },
    }
    const lines: string[] = []
    const marked = inheritFrom({
      root,
      graph: graphWithout,
      plan,
      previous: [source(plan, 'linux', seventh.tree)],
      environments: ['linux'],
      report: (line) => lines.push(line),
    })
    const running = marked.chains
      .flatMap((chain) => chain.tasks)
      .filter((task) => task.environment === 'linux' && task.inherited === undefined)
    expect({ reader: running.some((task) => task.id === 'e2e-beta:e2e'), lines }).toEqual({ reader: true, lines: [] })
  })

  it('says of each environment without earlier results that it inherits nothing', () => {
    const plan = fullAt(second)
    expect(inherit(plan, [source(plan, 'linux', first.tree)]).lines).toEqual([
      'nothing is inherited on windows: no earlier run left results that name the tree they stand on',
      'nothing is inherited on macos: no earlier run left results that name the tree they stand on',
    ])
  })

  it('gives the environments whose earlier runs stood on one tree the same change since', () => {
    const plan = fullAt(second)
    const marked = inherit(plan, [source(plan, 'linux', first.tree), source(plan, 'windows', first.tree)], ['linux', 'windows'])
    expect({ linux: marked.running['linux'], windows: marked.running['windows'], macos: marked.running['macos']?.length }).toEqual({
      linux: ['app-site:typecheck', 'app-site:lint', 'app-site:build'],
      windows: undefined,
      macos: 11,
    })
  })

  it('inherits nothing in a plan that runs everything, and says so', () => {
    const plan: TestedPlan = { ...createPlan({ graph, changes: null, main: false }), tested: fullAt(second).tested }
    const marked = inherit(plan, [source(plan, 'linux', first.tree)])
    expect({ same: marked.plan === plan, lines: marked.lines }).toEqual({
      same: true,
      lines: ['nothing is inherited: the plan runs everything'],
    })
  })

  it('inherits nothing from a tree the clone cannot be made to hold, and says so', () => {
    const plan = fullAt(second)
    const marked = inherit(plan, [source(plan, 'linux', ABSENT)], ['linux'])
    expect({ same: marked.plan === plan, lines: marked.lines }).toEqual({
      same: true,
      lines: ['nothing is inherited on linux from run 7: its tree fffffff is not in the clone and could not be fetched or rebuilt'],
    })
  })

  it("inherits nothing across a change to one of the pipeline's own files, and says which", () => {
    const plan = fullAt(third)
    expect(inherit(plan, [source(plan, 'linux', second.tree)], ['linux']).lines).toEqual([
      'nothing is inherited on linux from run 7: tools/pipeline/src/pipeline/report.ts changed since, and no task reads it as an input: it decides what a task runs or how its environment is set up',
    ])
  })

  it("inherits nothing across a file moved out of the pipeline's own files", () => {
    const plan = fullAt(fourth)
    expect(inherit(plan, [source(plan, 'linux', third.tree)], ['linux']).lines).toEqual([
      'nothing is inherited on linux from run 7: tools/pipeline/src/pipeline/report.ts changed since, and no task reads it as an input: it decides what a task runs or how its environment is set up',
    ])
  })

  it('inherits nothing across a change to a file that sets an environment up, which reaches no task of its own', () => {
    const plan = fullAt(sixth)
    const marked = inherit(plan, [source(plan, 'linux', fifth.tree)], ['linux'])
    expect({ same: marked.plan === plan, lines: marked.lines }).toEqual({
      same: true,
      lines: [
        'nothing is inherited on linux from run 7: .github/actions/setup-monorepo/action.yml changed since, and no task reads it as an input: it decides what a task runs or how its environment is set up',
      ],
    })
  })

  it('inherits nothing in a plan that publishes, and says so', () => {
    const plan: TestedPlan = { ...fullAt(second), main: true }
    const marked = inherit(plan, [source(plan, 'linux', first.tree)])
    expect({ same: marked.plan === plan, lines: marked.lines }).toEqual({
      same: true,
      lines: ['nothing is inherited: the plan publishes, and proves everything it ships itself'],
    })
  })

  it('inherits nothing when the change since cannot be planned, and says what failed', () => {
    const plan: TestedPlan = { ...fullAt(second), tested: { tree: ABSENT, head: null, base: null, merge: null } }
    const marked = inherit(plan, [source(plan, 'linux', first.tree)], ['linux'])
    expect({ same: marked.plan === plan, lines: marked.lines }).toEqual({
      same: true,
      lines: [expect.stringMatching(/^nothing is inherited on linux from run 7: the change since its tree could not be planned \(.+\)$/)],
    })
  })

  it('says so when a source proves nothing the plan holds', () => {
    const plan = fullAt(second)
    const unproven = { ...source(plan, 'linux', first.tree), proofs: createMap<string, Origin>() }
    expect(inherit(plan, [unproven], ['linux']).lines).toEqual([
      'no task is inherited: every task of the plan is reached by the change since, or has no proof',
    ])
  })
})
