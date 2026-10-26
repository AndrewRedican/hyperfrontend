import type { ProjectRecord } from '../graph/model'
import type { PlanReason, PlanTask } from './model'
import { after as afterAll } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createPipelineWorkspace, PIPELINE_WORKSPACE } from './__test-utils__/workspace'
import { buildChains, e2eProjectsOf, isPublishable, libraryOfE2e, linuxTasks, upstreamPackages, windowsTasks, withNeeds } from './fold'
import { planReason } from './model'

const workspace = createPipelineWorkspace()
const { graph } = workspace

afterAll(() => workspace.remove())

/**
 * A project of the fixture.
 *
 * @param name - Which project to read
 * @returns The record
 */
function project(name: string): ProjectRecord {
  return graph.projects.get(name) as ProjectRecord
}

/**
 * A selection of task ids, each with one reason.
 *
 * @param ids - The task ids
 * @returns The reasons by task id
 */
function selection(...ids: readonly string[]): Map<string, PlanReason[]> {
  return createMap(ids.map((id) => [id, [planReason('changed-input', `${id} changed`)]] as const))
}

/**
 * The ids and chain projects of tasks.
 *
 * @param tasks - Any tasks of a plan
 * @returns `<id> in <project>` per task, sorted
 */
function placed(tasks: readonly PlanTask[]): string[] {
  return tasks.map((task) => `${task.id} in ${task.project}`).sort()
}

describe('isPublishable', () => {
  it.each([
    ['lib-alpha', true],
    ['lib-testing', false],
    ['tool-ling', false],
    ['app-site', false],
  ])('answers %s with %s', (name, publishable) => {
    expect(isPublishable(project(name))).toBe(publishable)
  })
})

describe('libraryOfE2e', () => {
  it('names the library an e2e project tests', () => {
    expect(libraryOfE2e(graph, project('e2e-alpha'))?.name).toBe('lib-alpha')
  })

  it('answers null when no implicit dependency builds', () => {
    expect(libraryOfE2e(graph, project('e2e-orphan'))).toBeNull()
  })
})

describe('e2eProjectsOf', () => {
  it('finds the e2e projects of a library, by name', () => {
    const other = createPipelineWorkspace({
      ...PIPELINE_WORKSPACE,
      'apps/alpha-browser-e2e/project.json':
        '{ "name": "e2e-alpha-browser", "implicitDependencies": ["lib-alpha"], "targets": { "e2e": {} } }',
    })
    try {
      expect(e2eProjectsOf(other.graph, other.graph.projects.get('lib-alpha') as ProjectRecord).map((item) => item.name)).toEqual([
        'e2e-alpha',
        'e2e-alpha-browser',
      ])
    } finally {
      other.remove()
    }
  })
})

describe('upstreamPackages', () => {
  it('names the workspace packages a manifest depends on', () => {
    expect(upstreamPackages(graph, project('lib-beta')).map((item) => item.name)).toEqual(['lib-alpha'])
  })
})

describe('linuxTasks', () => {
  it('folds an e2e task into the chain of the library it tests', () => {
    expect(placed(linuxTasks(graph, selection('e2e-alpha:e2e'), false))).toEqual(['e2e-alpha:e2e in lib-alpha'])
  })

  it('keeps an e2e task that tests no library in its own chain', () => {
    expect(placed(linuxTasks(graph, selection('e2e-orphan:e2e'), false))).toEqual(['e2e-orphan:e2e in e2e-orphan'])
  })

  it('records the fold as a reason', () => {
    expect(linuxTasks(graph, selection('e2e-alpha:e2e'), false)[0]?.reasons.map((reason) => reason.rule)).toEqual([
      'changed-input',
      'folded',
    ])
  })

  it('adds the floor probe and the smokes after a publishable build', () => {
    expect(placed(linuxTasks(graph, selection('lib-alpha:build'), false))).toEqual([
      'lib-alpha:build in lib-alpha',
      'lib-alpha:probe in lib-alpha',
      'lib-alpha:smoke-floor in lib-alpha',
      'lib-alpha:smoke-major in lib-alpha',
    ])
  })

  it('probes on the declared floor with the built package as the dist', () => {
    const probe = linuxTasks(graph, selection('lib-alpha:build'), false).find((task) => task.target === 'probe')
    expect([probe?.command, probe?.env]).toEqual([
      ['npx', '-y', '-p', 'node@20.1.0', 'node', 'tools/workspace/scripts/probe-node-floor.mjs'],
      { HF_DIST: 'dist/libs/alpha' },
    ])
  })

  it('smokes on the floor and on the major', () => {
    expect(
      linuxTasks(graph, selection('lib-alpha:build'), false)
        .filter((task) => task.target.startsWith('smoke'))
        .map((task) => task.command[3])
    ).toEqual(['node@20.1.0', 'node@20'])
  })

  it('smokes once on the workspace Node.js when the library declares no floor', () => {
    const tree = { ...PIPELINE_WORKSPACE, 'apps/beta-e2e/scripts/consumer-smoke.mjs': 'process.exit(0)\n' }
    const other = createPipelineWorkspace(tree)
    try {
      expect(
        linuxTasks(other.graph, selection('lib-beta:build'), false)
          .filter((task) => task.target.startsWith('smoke'))
          .map((task) => task.command)
      ).toEqual([['node', 'apps/beta-e2e/scripts/consumer-smoke.mjs']])
    } finally {
      other.remove()
    }
  })

  it('leaves a private library without probe or smoke', () => {
    expect(placed(linuxTasks(graph, selection('lib-testing:build'), false))).toEqual(['lib-testing:build in lib-testing'])
  })

  it('drops publish tasks off main', () => {
    expect(placed(linuxTasks(graph, selection('lib-alpha:publish'), false))).toEqual([])
  })

  it('drops the publish of a private library on main', () => {
    expect(placed(linuxTasks(graph, selection('lib-testing:publish'), true))).toEqual([])
  })

  it('adds the build a publish needs on main', () => {
    expect(placed(linuxTasks(graph, selection('lib-alpha:publish'), true))).toEqual([
      'lib-alpha:build in lib-alpha',
      'lib-alpha:probe in lib-alpha',
      'lib-alpha:publish in lib-alpha',
      'lib-alpha:smoke-floor in lib-alpha',
      'lib-alpha:smoke-major in lib-alpha',
    ])
  })

  it('weighs a library build heavy and everything else light', () => {
    expect(
      linuxTasks(graph, selection('lib-alpha:build', 'lib-alpha:test', 'app-site:build'), false).map((task) => `${task.id} ${task.weight}`)
    ).toEqual([
      'lib-alpha:build heavy',
      'lib-alpha:test light',
      'app-site:build light',
      'lib-alpha:probe light',
      'lib-alpha:smoke-floor light',
      'lib-alpha:smoke-major light',
    ])
  })

  it('ignores a task of a project the graph does not know', () => {
    expect(linuxTasks(graph, selection('lib-nobody:build'), false)).toEqual([])
  })
})

describe('windowsTasks', () => {
  it('copies the typecheck, lint and test of libraries and tools', () => {
    const linux = linuxTasks(
      graph,
      selection('lib-alpha:typecheck', 'lib-alpha:lint', 'lib-alpha:test', 'tool-ling:test', 'app-site:typecheck', 'lib-alpha:e2e'),
      false
    )
    expect(windowsTasks(graph, linux).map((task) => `${task.id} ${task.environment}`)).toEqual([
      'lib-alpha:typecheck windows',
      'lib-alpha:lint windows',
      'lib-alpha:test windows',
      'tool-ling:test windows',
    ])
  })

  it('copies the build and the smokes of a library with a consumer smoke', () => {
    expect(windowsTasks(graph, linuxTasks(graph, selection('lib-alpha:build', 'lib-beta:build'), false)).map((task) => task.id)).toEqual([
      'lib-alpha:build',
      'lib-alpha:smoke-floor',
      'lib-alpha:smoke-major',
    ])
  })
})

describe('withNeeds', () => {
  const linux = linuxTasks(
    graph,
    selection(
      'lib-alpha:typecheck',
      'lib-alpha:build',
      'e2e-alpha:e2e',
      'lib-alpha:publish',
      'lib-beta:build',
      'lib-beta:publish',
      'lib-beta:serve'
    ),
    true
  )
  const needs = createMap(withNeeds(graph, linux).map((task) => [task.id, task.needs] as const))

  it.each([
    ['lib-alpha:typecheck', []],
    ['lib-alpha:build', ['lib-alpha:typecheck']],
    ['e2e-alpha:e2e', ['lib-alpha:build']],
    ['lib-alpha:probe', ['lib-alpha:build']],
    ['lib-alpha:smoke-major', ['lib-alpha:build']],
    [
      'lib-alpha:publish',
      ['e2e-alpha:e2e', 'lib-alpha:build', 'lib-alpha:probe', 'lib-alpha:smoke-floor', 'lib-alpha:smoke-major', 'lib-alpha:typecheck'],
    ],
    ['lib-beta:publish', ['lib-alpha:publish', 'lib-beta:build', 'lib-beta:probe', 'lib-beta:serve']],
    ['lib-beta:serve', ['lib-beta:build']],
  ])('%s needs %s', (id, expected) => {
    expect(needs.get(id)).toEqual(expected)
  })

  it('keeps the needs inside one environment', () => {
    const both = withNeeds(graph, [...linux, ...windowsTasks(graph, linux)])
    expect(both.filter((task) => task.environment === 'windows').map((task) => `${task.id}: ${task.needs.join(',')}`)).toEqual([
      'lib-alpha:typecheck: ',
      'lib-alpha:build: lib-alpha:typecheck',
      'lib-alpha:smoke-floor: lib-alpha:build',
      'lib-alpha:smoke-major: lib-alpha:build',
    ])
  })
})

describe('buildChains', () => {
  it('groups the tasks by environment and project, needs first', () => {
    const linux = linuxTasks(graph, selection('lib-alpha:publish', 'e2e-alpha:e2e', 'lib-alpha:test', 'lib-alpha:typecheck'), true)
    const chains = buildChains(withNeeds(graph, [...linux, ...windowsTasks(graph, linux)]))
    expect(chains.map((chain) => `${chain.environment} ${chain.project}: ${chain.tasks.map((task) => task.target).join(' ')}`)).toEqual([
      'linux lib-alpha: typecheck test build e2e probe smoke-floor smoke-major publish',
      'windows lib-alpha: typecheck test build smoke-floor smoke-major',
    ])
  })

  it('places the tasks of a dependency loop in rank order, for the scheduler to refuse', () => {
    const chains = buildChains(withNeeds(graph, linuxTasks(graph, selection('lib-beta:loop-a', 'lib-beta:loop-b'), false)))
    expect(chains[0]?.tasks.map((task) => task.target)).toEqual(['loop-a', 'loop-b'])
  })
})
