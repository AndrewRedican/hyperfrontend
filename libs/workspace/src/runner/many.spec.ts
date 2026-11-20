import type { FileTree } from '@hyperfrontend/testing/fs'
import type { ManyRequest, PlannedTask, TaskOutcome } from './many'
import { after as afterAll } from 'node:test'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { buildGraph } from '../graph/build'
import { manySummary, matchesProject, parseAffectedArgs, parseManyArgs, planMany, planTasks, runPlanned } from './many'

/** An application building after two libraries, one of which tests after its build, and a pair of targets that wait on each other. */
const TREE: FileTree = {
  'package.json': { name: '@fixture/workspace', private: true },
  'package-lock.json': { name: '@fixture/workspace', lockfileVersion: 3, packages: { '': { name: '@fixture/workspace' } } },
  'hf.json': { targetDefaults: { build: { dependsOn: ['^build'] } } },
  'tsconfig.base.json': {
    compilerOptions: { paths: { '@fixture/core': ['libs/core/src/index.ts'], '@fixture/util': ['libs/util/src/index.ts'] } },
  },
  'libs/core/project.json': { name: 'lib-core', projectType: 'library', targets: { build: {}, test: { dependsOn: ['build'] } } },
  'libs/core/src/index.ts': 'export const core = 1\n',
  'libs/util/project.json': { name: 'lib-util', projectType: 'library', targets: { build: {} } },
  'libs/util/src/index.ts': 'export const util = 1\n',
  'apps/shop/project.json': {
    name: 'app-shop',
    projectType: 'application',
    targets: { build: {}, ping: { dependsOn: ['pong'] }, pong: { dependsOn: ['ping'] } },
  },
  'apps/shop/src/main.ts': "import { core } from '@fixture/core'\nimport { util } from '@fixture/util'\nexport const shop = core + util\n",
}

const fixture = createTempDir({ prefix: 'run-many-', tree: TREE })
afterAll(() => fixture.remove())
const graph = buildGraph(fixture.path, { files: keys(TREE) })

/**
 * The ids of planned tasks.
 *
 * @param tasks - The planned tasks, in order
 * @returns Their ids in order
 */
function ids(tasks: readonly PlannedTask[]): string[] {
  return tasks.map((task) => task.id)
}

/**
 * A request for targets in one stage, with nothing passed on.
 *
 * @param targets - What every chosen project is asked to run
 * @param projects - The project names and globs, or null for every project
 * @returns A request that streams nothing and passes nothing on
 */
function request(targets: readonly string[], projects: readonly string[] | null): ManyRequest {
  return { targets, stages: [targets], projects, args: [], stream: false }
}

describe('parseManyArgs', () => {
  it('reads targets, projects and the arguments passed on', () => {
    expect(parseManyArgs(['-t', 'build,test', '--projects=lib-*', '-p', 'app-shop', '--verbose'])).toEqual({
      targets: ['build', 'test'],
      stages: [['build', 'test']],
      projects: ['lib-*', 'app-shop'],
      args: ['--verbose'],
      stream: false,
    })
  })

  it('reads every project', () => {
    expect(parseManyArgs(['--targets=audit', '--all'])).toEqual({
      targets: ['audit'],
      stages: [['audit']],
      projects: null,
      args: [],
      stream: false,
    })
  })

  it('reads each target option as a stage of its own, naming a target twice once', () => {
    expect(parseManyArgs(['-t', 'typecheck,lint', '--all', '-t', 'test,lint', '--target='])).toEqual(
      expect.objectContaining({
        targets: ['typecheck', 'lint', 'test'],
        stages: [
          ['typecheck', 'lint'],
          ['test', 'lint'],
        ],
      })
    )
  })

  it('keeps the stream option to itself', () => {
    expect(parseManyArgs(['-t', 'build', '--all', '--stream'])).toEqual(expect.objectContaining({ args: [], stream: true }))
  })

  it('reads a target named last without a value as none', () => {
    expect(() => parseManyArgs(['--all', '--target'])).toThrow('name the targets with -t')
  })

  it('refuses a request naming no project', () => {
    expect(() => parseManyArgs(['-t', 'build'])).toThrow('name the projects with -p, or pass --all')
  })

  it('reads a project option named last without a value as no project', () => {
    expect(parseManyArgs(['-t', 'build', '-p']).projects).toEqual([])
  })
})

describe('parseAffectedArgs', () => {
  it('reads targets, the base, the head and the arguments passed on', () => {
    expect(parseAffectedArgs(['-t', 'build', '--targets=test', '--base=main', '--head', 'HEAD~1', '--fix'])).toEqual({
      targets: ['build', 'test'],
      stages: [['build'], ['test']],
      base: 'main',
      head: 'HEAD~1',
      args: ['--fix'],
      stream: false,
    })
  })

  it('defaults to origin/main and the working tree', () => {
    expect(parseAffectedArgs(['-t', 'build'])).toEqual({
      targets: ['build'],
      stages: [['build']],
      base: 'origin/main',
      head: null,
      args: [],
      stream: false,
    })
  })

  it('keeps the stream option to itself', () => {
    expect(parseAffectedArgs(['-t', 'build', '--stream'])).toEqual(expect.objectContaining({ args: [], stream: true }))
  })

  it('keeps the base for a base option named last without a value', () => {
    expect(parseAffectedArgs(['-t', 'build', '--base']).base).toBe('origin/main')
  })

  it('keeps the working tree for a head option named last without a value', () => {
    expect(parseAffectedArgs(['-t', 'build', '--head']).head).toBeNull()
  })

  it('refuses a request naming no target', () => {
    expect(() => parseAffectedArgs(['--base=main'])).toThrow('name the targets with -t')
  })

  it('reads a target option named last without a value as none', () => {
    expect(() => parseAffectedArgs(['-t'])).toThrow('name the targets with -t')
  })
})

describe('matchesProject', () => {
  it('matches a name exactly', () => {
    expect(matchesProject('lib-core', 'lib-core')).toBe(true)
  })

  it('matches a glob with a wildcard inside', () => {
    expect(matchesProject('demo-koi-fish-react', 'demo-*-fish-*')).toBe(true)
  })

  it('refuses a name shorter than the glob around its wildcard', () => {
    expect(matchesProject('ab', 'ab*b')).toBe(false)
  })

  it('refuses a name whose middle part is missing', () => {
    expect(matchesProject('demo-koi-pond', 'demo-*-fish-*')).toBe(false)
  })

  it('refuses a middle part that overlaps the end', () => {
    expect(matchesProject('a-b', 'a*b*b')).toBe(false)
  })
})

describe('planMany', () => {
  it('places every build after the builds it depends on', () => {
    expect(ids(planMany(graph, request(['build'], ['app-shop'])))).toEqual(['lib-core:build', 'lib-util:build', 'app-shop:build'])
  })

  it('places a prerequisite outside the requested targets and marks it unrequested', () => {
    expect(planMany(graph, request(['test'], null))).toEqual([
      { id: 'lib-core:build', requested: false, after: [] },
      { id: 'lib-core:test', requested: true, after: ['lib-core:build'] },
    ])
  })

  it('runs a task reached twice once', () => {
    expect(ids(planMany(graph, request(['build'], ['lib-*', 'app-shop'])))).toEqual(['lib-core:build', 'lib-util:build', 'app-shop:build'])
  })

  it('refuses a cycle with its path', () => {
    expect(() => planMany(graph, request(['ping'], ['app-shop']))).toThrow(
      "the tasks' dependsOn form a cycle: app-shop:ping -> app-shop:pong -> app-shop:ping"
    )
  })

  it('refuses a project nothing matches', () => {
    expect(() => planMany(graph, request(['build'], ['nobody']))).toThrow('no project matches nobody')
  })
})

describe('planTasks', () => {
  it('places named tasks after their prerequisites', () => {
    expect(ids(planTasks(graph, [{ project: 'lib-core', target: 'test' }]))).toEqual(['lib-core:build', 'lib-core:test'])
  })
})

describe('runPlanned', () => {
  const tasks: PlannedTask[] = [
    { id: 'a:build', requested: false, after: [] },
    { id: 'b:build', requested: true, after: ['a:build'] },
    { id: 'c:build', requested: true, after: [] },
  ]

  it('skips a task whose prerequisite failed and runs the rest', async () => {
    const outcomes = await runPlanned(tasks, [], {
      runChild: async (id) => (id === 'a:build' ? 1 : 0),
      now: () => 0,
      write: () => undefined,
    })
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['failed', 'skipped', 'succeeded'])
  })

  it('names the prerequisite that kept a task from running', async () => {
    const outcomes = await runPlanned(tasks, [], { runChild: async () => 1, now: () => 0, write: () => undefined })
    expect(outcomes[1]).toEqual({ id: 'b:build', status: 'skipped', durationMs: 0, blockedBy: 'a:build' })
  })

  it('takes a prerequisite that is not among the tasks as met', async () => {
    const outcomes = await runPlanned(tasks.slice(1), [], { runChild: async () => 0, now: () => 0, write: () => undefined })
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['succeeded', 'succeeded'])
  })

  it('tells the host of each task that starts and of each that ends or is skipped', async () => {
    const events: string[] = []
    await runPlanned(tasks, [], {
      runChild: async (id) => (id === 'a:build' ? 1 : 0),
      now: () => 0,
      write: () => undefined,
      onStart: (id) => events.push(`start ${id}`),
      onEnd: (outcome: TaskOutcome) => events.push(`${outcome.status} ${outcome.id}`),
    })
    expect(events).toEqual(['start a:build', 'failed a:build', 'skipped b:build', 'start c:build', 'succeeded c:build'])
  })

  it('passes the arguments to requested tasks alone', async () => {
    const received: string[] = []
    await runPlanned(tasks, ['--verbose'], {
      runChild: async (id, args) => {
        received.push(`${id} ${args.join(' ')}`.trim())
        return 0
      },
      now: () => 0,
      write: () => undefined,
    })
    expect(received).toEqual(['a:build', 'b:build --verbose', 'c:build --verbose'])
  })
})

describe('manySummary', () => {
  it('lists each task and counts each ending', () => {
    expect(
      manySummary([
        { id: 'a:build', status: 'succeeded', durationMs: 1500 },
        { id: 'b:build', status: 'skipped', durationMs: 0 },
      ])
    ).toEqual(['  succeeded a:build (1.5 s)', '  skipped   b:build (0.0 s)', '1 succeeded, 0 failed, 1 skipped'])
  })
})
