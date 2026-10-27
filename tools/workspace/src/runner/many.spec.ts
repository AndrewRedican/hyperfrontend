import type { FileTree } from '@hyperfrontend/testing/fs'
import type { PlannedTask } from './many'
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
  'nx.json': { targetDefaults: { build: { dependsOn: ['^build'] } } },
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

describe('parseManyArgs', () => {
  it('reads targets, projects and the arguments passed on', () => {
    expect(parseManyArgs(['-t', 'build,test', '--projects=lib-*', '-p', 'app-shop', '--verbose'])).toEqual({
      targets: ['build', 'test'],
      projects: ['lib-*', 'app-shop'],
      args: ['--verbose'],
    })
  })

  it('reads every project', () => {
    expect(parseManyArgs(['--targets=audit', '--all'])).toEqual({ targets: ['audit'], projects: null, args: [] })
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
      base: 'main',
      head: 'HEAD~1',
      args: ['--fix'],
    })
  })

  it('defaults to origin/main and the working tree', () => {
    expect(parseAffectedArgs(['-t', 'build'])).toEqual({ targets: ['build'], base: 'origin/main', head: null, args: [] })
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
    expect(ids(planMany(graph, { targets: ['build'], projects: ['app-shop'], args: [] }))).toEqual([
      'lib-core:build',
      'lib-util:build',
      'app-shop:build',
    ])
  })

  it('places a prerequisite outside the requested targets and marks it unrequested', () => {
    expect(planMany(graph, { targets: ['test'], projects: null, args: [] })).toEqual([
      { id: 'lib-core:build', requested: false, after: [] },
      { id: 'lib-core:test', requested: true, after: ['lib-core:build'] },
    ])
  })

  it('runs a task reached twice once', () => {
    expect(ids(planMany(graph, { targets: ['build'], projects: ['lib-*', 'app-shop'], args: [] }))).toEqual([
      'lib-core:build',
      'lib-util:build',
      'app-shop:build',
    ])
  })

  it('refuses a cycle with its path', () => {
    expect(() => planMany(graph, { targets: ['ping'], projects: ['app-shop'], args: [] })).toThrow(
      "the tasks' dependsOn form a cycle: app-shop:ping -> app-shop:pong -> app-shop:ping"
    )
  })

  it('refuses a project nothing matches', () => {
    expect(() => planMany(graph, { targets: ['build'], projects: ['nobody'], args: [] })).toThrow('no project matches nobody')
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
