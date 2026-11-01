import type { ProjectRecord } from '../graph/model'
import type { PlanReason, PlanTask } from './model'
import { after as afterAll } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { libraryOfE2e } from '../graph/depends-on'
import { createPipelineWorkspace, PIPELINE_WORKSPACE } from './__test-utils__/workspace'
import { buildChains, e2eProjectsOf, isPublishable, linuxTasks, railwayService, upstreamPackages, windowsTasks, withNeeds } from './fold'
import { planReason } from './model'

const workspace = createPipelineWorkspace()
const { graph } = workspace

afterAll(() => workspace.remove())

/** The files a root project is read from. */
const ROOT_MANIFESTS = ['project.json', 'package.json', 'package-lock.json']

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
 * The first demo with other deploy metadata.
 *
 * @param deploy - What `metadata.deploy` holds
 * @returns The record
 */
function withDeploy(deploy: Readonly<Record<string, unknown>>): ProjectRecord {
  const record = project('demo-one')
  return { ...record, configuration: { ...record.configuration, metadata: { deploy } } }
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

describe('railwayService', () => {
  it('names the service of a project deploying to Railway', () => {
    expect(railwayService(project('demo-one'))).toBe('one')
  })

  it.each([
    ['no metadata', project('demo-two')],
    ['no configuration', { ...project('demo-two'), configuration: null }],
    ['another provider', withDeploy({ provider: 'vercel', service: 'one' })],
    ['no service name', withDeploy({ provider: 'railway', service: 1 })],
  ])('answers null for a project with %s', (_, record) => {
    expect(railwayService(record)).toBeNull()
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
    expect(linuxTasks(graph, selection('e2e-alpha:e2e'), false).find((task) => task.id === 'e2e-alpha:e2e')?.project).toBe('lib-alpha')
  })

  it('gives an e2e task the build of its library, with the probe and smokes that follow every library build', () => {
    expect(placed(linuxTasks(graph, selection('e2e-alpha:e2e'), false))).toEqual([
      'e2e-alpha:e2e in lib-alpha',
      'lib-alpha:build in lib-alpha',
      'lib-alpha:probe in lib-alpha',
      'lib-alpha:smoke-floor in lib-alpha',
      'lib-alpha:smoke-major in lib-alpha',
    ])
  })

  it('plans no build of the other workspace packages an e2e task reaches', () => {
    expect(
      linuxTasks(graph, selection('e2e-alpha:e2e'), false)
        .filter((task) => task.target === 'build')
        .map((task) => task.id)
    ).toEqual(['lib-alpha:build'])
  })

  it('plans one build for every task needing it, naming them', () => {
    expect(
      linuxTasks(graph, selection('e2e-alpha:e2e', 'lib-alpha:publish'), true)
        .filter((task) => task.target === 'build')
        .map((task) => ({ id: task.id, reasons: task.reasons }))
    ).toEqual([
      {
        id: 'lib-alpha:build',
        reasons: [
          {
            rule: 'pipeline-task',
            file: null,
            path: ['e2e-alpha:e2e', 'lib-alpha:publish'],
            message: 'needed first by e2e-alpha:e2e, lib-alpha:publish',
          },
        ],
      },
    ])
  })

  it('keeps the selection reasons of a prerequisite selected on its own', () => {
    expect(
      linuxTasks(graph, selection('e2e-alpha:e2e', 'lib-alpha:build'), false)
        .find((task) => task.id === 'lib-alpha:build')
        ?.reasons.map((reason) => reason.rule)
    ).toEqual(['changed-input'])
  })

  it('plans one install for every task of the project needing it', () => {
    expect(
      linuxTasks(graph, selection('demo-one:build', 'demo-one:typecheck'), false)
        .filter((task) => task.target === 'install')
        .map((task) => ({ id: task.id, project: task.project, reasons: task.reasons.map((reason) => [reason.message, reason.path]) }))
    ).toEqual([
      {
        id: 'demo-one:install',
        project: 'demo-one',
        reasons: [['needed first by demo-one:build, demo-one:typecheck', ['demo-one:build', 'demo-one:typecheck']]],
      },
    ])
  })

  it('plans the task of another project a project:target prerequisite names, with what it needs first', () => {
    expect(placed(linuxTasks(graph, selection('demo-two:build'), false))).toEqual([
      'demo-one:install in demo-one',
      'demo-one:verify in demo-one',
      'demo-two:build in demo-two',
      'demo-two:install in demo-two',
    ])
  })

  it('runs every task of a project target through the owned task command', () => {
    expect(linuxTasks(graph, selection('demo-two:build'), false).map((task) => `${task.id}: ${task.command.join(' ')}`)).toEqual([
      'demo-two:build: node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/hf.ts run demo-two:build',
      'demo-two:install: node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/hf.ts run demo-two:install',
      'demo-one:verify: node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/hf.ts run demo-one:verify',
      'demo-one:install: node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/bin/hf.ts run demo-one:install',
    ])
  })

  it('weighs an added library build heavy and an added install light', () => {
    expect(
      linuxTasks(graph, selection('e2e-alpha:e2e', 'demo-one:build'), false)
        .filter((task) => task.target === 'build' || task.target === 'install')
        .map((task) => `${task.id} ${task.weight}`)
    ).toEqual(['demo-one:build light', 'lib-alpha:build heavy', 'demo-one:install light'])
  })

  it('keeps the dependsOn entries of an e2e task beside its library build', () => {
    const other = createPipelineWorkspace({
      ...PIPELINE_WORKSPACE,
      'apps/beta-e2e/project.json':
        '{ "name": "e2e-beta", "implicitDependencies": ["lib-beta"], "targets": { "seed": {}, "e2e": { "dependsOn": ["^build", "seed"] } } }',
    })
    try {
      expect(placed(linuxTasks(other.graph, selection('e2e-beta:e2e'), false))).toEqual([
        'e2e-beta:e2e in lib-beta',
        'e2e-beta:seed in e2e-beta',
        'lib-beta:build in lib-beta',
        'lib-beta:probe in lib-beta',
      ])
    } finally {
      other.remove()
    }
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

  it('adds the deploy after the build of a demo that declares a Railway service on main', () => {
    expect(placed(linuxTasks(graph, selection('demo-one:build'), true))).toEqual([
      'demo-one:build in demo-one',
      'demo-one:deploy in demo-one',
      'demo-one:install in demo-one',
      'workspace:provision in workspace',
    ])
  })

  it('adds the provision on main when the Railway configuration changed and nothing deploys', () => {
    expect(placed(linuxTasks(graph, selection(), true, true))).toEqual(['workspace:provision in workspace'])
  })

  it('drops the provision off main', () => {
    expect(placed(linuxTasks(graph, selection(), false, true))).toEqual([])
  })

  it('provisions through the provision script in the chain of the root project', () => {
    const provision = linuxTasks(graph, selection(), true, true)[0] as PlanTask
    expect({ command: provision.command, env: provision.env, weight: provision.weight, reasons: provision.reasons }).toEqual({
      command: ['node', 'tools/workspace/scripts/railway-provision.mjs'],
      env: {},
      weight: 'light',
      reasons: [planReason('pipeline-task', 'applies .railway/railway.ts to the production environment before the deploys')],
    })
  })

  it('leaves the provision out when no project owns the Railway configuration', () => {
    const other = createPipelineWorkspace(fromEntries(entries(PIPELINE_WORKSPACE).filter(([file]) => !ROOT_MANIFESTS.includes(file))))
    try {
      expect(placed(linuxTasks(other.graph, selection('demo-one:build'), true))).toEqual([
        'demo-one:build in demo-one',
        'demo-one:deploy in demo-one',
        'demo-one:install in demo-one',
      ])
    } finally {
      other.remove()
    }
  })

  it('drops the deploy off main', () => {
    expect(placed(linuxTasks(graph, selection('demo-one:build'), false))).toEqual([
      'demo-one:build in demo-one',
      'demo-one:install in demo-one',
    ])
  })

  it('leaves a built demo that declares no Railway service undeployed', () => {
    expect(placed(linuxTasks(graph, selection('demo-two:build'), true))).toEqual([
      'demo-one:install in demo-one',
      'demo-one:verify in demo-one',
      'demo-two:build in demo-two',
      'demo-two:install in demo-two',
    ])
  })

  it('deploys through the deploy script with the service in the environment', () => {
    const deploy = linuxTasks(graph, selection('demo-one:build'), true).find((task) => task.target === 'deploy') as PlanTask
    expect({ command: deploy.command, env: deploy.env, weight: deploy.weight, reasons: deploy.reasons }).toEqual({
      command: ['node', 'tools/workspace/scripts/railway-deploy.mjs'],
      env: { HF_DEPLOY_SERVICE: 'one' },
      weight: 'light',
      reasons: [planReason('pipeline-task', 'deploys the commit to the Railway service one', ['demo-one:build'])],
    })
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

  it('adds the tasks the copied tasks need first', () => {
    const other = createPipelineWorkspace({
      ...PIPELINE_WORKSPACE,
      'tools/tooling/project.json': '{ "name": "tool-ling", "targets": { "install": {}, "test": { "dependsOn": ["install"] } } }',
    })
    try {
      expect(
        windowsTasks(other.graph, linuxTasks(other.graph, selection('tool-ling:test'), false)).map(
          (task) => `${task.id} ${task.environment}`
        )
      ).toEqual(['tool-ling:test windows', 'tool-ling:install windows'])
    } finally {
      other.remove()
    }
  })

  it('copies the build and the smokes of a library with a consumer smoke', () => {
    expect(windowsTasks(graph, linuxTasks(graph, selection('lib-alpha:build', 'lib-beta:build'), false)).map((task) => task.id)).toEqual([
      'lib-alpha:build',
      'lib-alpha:smoke-floor',
      'lib-alpha:smoke-major',
    ])
  })

  it('gives a copied build the smokes it is there for as its reason, in place of the Linux tasks needing it', () => {
    const build = windowsTasks(graph, linuxTasks(graph, selection('e2e-alpha:e2e'), false)).find((task) => task.id === 'lib-alpha:build')
    expect(build?.reasons.map((reason) => `${reason.rule}: ${reason.message}`)).toEqual([
      'pipeline-task: needed first by lib-alpha:smoke-floor, lib-alpha:smoke-major',
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

describe('withNeeds across projects', () => {
  const needs = createMap(
    withNeeds(graph, linuxTasks(graph, selection('demo-two:build', 'demo-one:typecheck'), false)).map(
      (task) => [task.id, task.needs] as const
    )
  )

  it.each([
    ['demo-two:build', ['demo-one:verify', 'demo-two:install']],
    ['demo-two:install', []],
    ['demo-one:verify', ['demo-one:install']],
    ['demo-one:typecheck', ['demo-one:install']],
    ['demo-one:install', []],
  ])('%s needs %s', (id, expected) => {
    expect(needs.get(id)).toEqual(expected)
  })

  it('runs a verify after the build of its project when the plan builds it', () => {
    const tasks = withNeeds(graph, linuxTasks(graph, selection('demo-two:build', 'demo-one:build'), false))
    expect(tasks.find((task) => task.id === 'demo-one:verify')?.needs).toEqual(['demo-one:build', 'demo-one:install'])
  })

  it('runs a deploy after every other task of its chain', () => {
    const tasks = withNeeds(graph, linuxTasks(graph, selection('demo-one:build', 'demo-one:typecheck'), true))
    expect(tasks.find((task) => task.id === 'demo-one:deploy')?.needs).toEqual([
      'demo-one:build',
      'demo-one:install',
      'demo-one:typecheck',
      'workspace:provision',
    ])
  })

  it('runs the provision after every other task of the workspace chain', () => {
    const tasks = withNeeds(graph, linuxTasks(graph, selection('workspace:lint', 'demo-one:build'), true))
    expect(tasks.find((task) => task.id === 'workspace:provision')?.needs).toEqual(['workspace:lint'])
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

  it('orders a chain by its own needs alone when a task needs another chain', () => {
    const chains = buildChains(withNeeds(graph, linuxTasks(graph, selection('demo-two:build', 'demo-one:build'), false)))
    expect(chains.map((chain) => `${chain.project}: ${chain.tasks.map((task) => task.target).join(' ')}`)).toEqual([
      'demo-one: install build verify',
      'demo-two: install build',
    ])
  })

  it('places the tasks of a dependency loop in rank order, for the scheduler to refuse', () => {
    const chains = buildChains(withNeeds(graph, linuxTasks(graph, selection('lib-beta:loop-a', 'lib-beta:loop-b'), false)))
    expect(chains[0]?.tasks.map((task) => task.target)).toEqual(['loop-a', 'loop-b'])
  })
})
