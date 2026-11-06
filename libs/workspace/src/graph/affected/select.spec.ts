import type { WorkspaceGraph } from '../build'
import type { AffectedSet, ChangeSet, ReasonRule } from '../selection'
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { after as afterAll } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from '../__test-utils__/workspace'
import { fixtureNamed, plantFixture } from '../__test-utils__/workspace-fixtures'
import { buildGraph, workspaceGraph } from '../build'
import { changeSet } from '../changes'
import { selectAffected } from './select'

/** A scenario analysed: both graphs and the change set. */
interface Analysed {
  /** The graph at the head. */
  readonly graph: WorkspaceGraph
  /** The graph at the base. */
  readonly previous: WorkspaceGraph
  /** The changes. */
  readonly changes: ChangeSet
  /** Deletes the repository. */
  readonly remove: () => void
}

/** Every build task of the fixture. */
const ALL_BUILDS = [
  'app-beta',
  'app-consumer',
  'lib-alpha',
  'lib-beta',
  'lib-cycle-a',
  'lib-cycle-b',
  'lib-delta',
  'lib-gamma',
  'lib-testing',
  'lib-tooling',
]

/** Every lint task of the fixture: the builds' projects and the e2e project, whose lint target is inferred. */
const ALL_LINTS = [...ALL_BUILDS.slice(0, 2), 'e2e-alpha', ...ALL_BUILDS.slice(2)]

const analysed = createMap<string, Analysed>()

afterAll(() => {
  for (const item of analysed.values()) item.remove()
})

/**
 * Plants a scenario and builds the graph at its base and at its head.
 *
 * @param name - The scenario's name
 * @returns The graphs and the changes
 */
function analyse(name: string): Analysed {
  let item = analysed.get(name)
  if (item === undefined) {
    const planted = plantFixture(fixtureNamed(name))
    execFileSync('git', ['checkout', '-q', planted.base], { cwd: planted.root })
    const previous = buildGraph(planted.root)
    execFileSync('git', ['checkout', '-q', planted.head], { cwd: planted.root })
    item = {
      graph: buildGraph(planted.root),
      previous,
      changes: changeSet(planted.root, planted.base, planted.head),
      remove: planted.remove,
    }
    analysed.set(name, item)
  }
  return item
}

/**
 * The projects whose task of a target a scenario selects.
 *
 * @param name - The scenario
 * @param target - The target decided
 * @param withPrevious - Whether the base graph is handed to the analysis
 * @returns The project names, sorted
 */
function selects(name: string, target: string, withPrevious = true): string[] {
  const item = analyse(name)
  const sets = selectAffected({
    graph: item.graph,
    changes: item.changes,
    targets: [target],
    ...(withPrevious ? { previous: item.previous } : {}),
  })
  return (sets.get(target) as AffectedSet).selected.map((decision) => decision.task.slice(0, -target.length - 1))
}

/**
 * The rules behind one task's decision.
 *
 * @param name - The scenario
 * @param task - The task id
 * @param withPrevious - Whether the base graph is handed to the analysis
 * @returns The rules of the selected or skipped decision, sorted and deduplicated
 */
function rulesOf(name: string, task: string, withPrevious = true): ReasonRule[] {
  const item = analyse(name)
  const target = task.slice(task.indexOf(':') + 1)
  const set = selectAffected({
    graph: item.graph,
    changes: item.changes,
    targets: [target],
    ...(withPrevious ? { previous: item.previous } : {}),
  }).get(target) as AffectedSet
  const decision = [...set.selected, ...set.skipped].find((candidate) => candidate.task === task)
  return [...new Set(decision?.reasons.map((reason) => reason.rule) ?? [])].sort()
}

/**
 * The decision of one task.
 *
 * @param name - The scenario
 * @param task - The task id
 * @returns Whether it is selected and its messages
 */
function decisionOf(name: string, task: string): { selected: boolean; messages: string[] } {
  const item = analyse(name)
  const target = task.slice(task.indexOf(':') + 1)
  const set = selectAffected({ graph: item.graph, changes: item.changes, targets: [target], previous: item.previous }).get(
    target
  ) as AffectedSet
  const selected = set.selected.find((candidate) => candidate.task === task)
  const decision = selected ?? set.skipped.find((candidate) => candidate.task === task)
  return { selected: selected !== undefined, messages: decision?.reasons.map((reason) => reason.message) ?? [] }
}

describe('the acceptance scenarios', () => {
  it.each([
    ['unused-entry-edit', 'build', ['app-beta', 'lib-alpha', 'lib-beta']],
    ['unused-entry-edit', 'test', ['lib-alpha']],
    ['unused-entry-edit', 'typecheck', ['app-beta', 'lib-alpha', 'lib-beta']],
    ['unused-entry-edit', 'lint', ['lib-alpha']],
    ['unused-entry-edit', 'e2e', ['e2e-alpha']],
    ['shared-internal-edit', 'build', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
    ['shared-internal-edit', 'test', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
    ['spec-only-dependency-edit', 'build', ['lib-delta', 'lib-testing']],
    ['spec-only-dependency-edit', 'test', ['lib-alpha', 'lib-delta', 'lib-testing']],
    ['spec-only-dependency-edit', 'typecheck', ['lib-alpha', 'lib-delta', 'lib-testing']],
    ['spec-only-dependency-edit', 'lint', ['lib-testing']],
    ['type-only-edit', 'build', ['app-beta', 'lib-alpha', 'lib-beta']],
    ['type-only-edit', 'typecheck', ['app-beta', 'lib-alpha', 'lib-beta']],
    ['type-only-edit', 'test', ['lib-alpha']],
    ['side-effect-target-edit', 'build', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
    ['barrel-target-edit', 'build', ['app-beta', 'lib-beta']],
    ['cycle-edit', 'build', ['lib-cycle-a', 'lib-cycle-b']],
    ['cycle-edit', 'test', ['lib-cycle-a', 'lib-cycle-b']],
    ['tool-edit', 'build', ALL_BUILDS],
    ['tool-edit', 'e2e', ['e2e-alpha']],
    ['tool-edit', 'test', ['lib-tooling']],
    ['root-input-edit', 'docs', ['workspace']],
    ['root-input-edit', 'build', []],
    ['global-config-edit', 'build', ALL_BUILDS],
    ['global-config-edit', 'docs', ['workspace']],
    ['renamed-module', 'build', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
    ['deleted-project-file', 'build', ['app-beta']],
    ['deleted-project-file', 'typecheck', ['app-beta']],
    ['dynamic-importer-edit', 'build', ['app-consumer', 'lib-gamma']],
    ['dynamic-importer-edit', 'lint', ['lib-gamma']],
    ['parse-failure', 'build', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
    ['deleted-module', 'build', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
    ['lint-config-edit', 'lint', ALL_LINTS],
    ['lint-config-edit', 'build', []],
    ['lint-config-edit', 'docs', []],
    ['re-exported-project-edit', 'build', ['lib-delta', 'lib-testing']],
    ['re-exported-project-edit', 'test', ['lib-delta', 'lib-testing']],
    ['renamed-module-dangling', 'build', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
    ['deleted-module-rewired', 'build', ['app-beta', 'app-consumer', 'lib-alpha', 'lib-beta']],
  ])('%s selects for %s', (name, target, expected) => {
    expect(selects(name, target)).toEqual(expected)
  })
})

describe('the rules behind the decisions', () => {
  it.each([
    ['unused-entry-edit', 'lib-alpha:build', ['changed-input']],
    ['unused-entry-edit', 'app-consumer:build', ['unreachable']],
    ['unused-entry-edit', 'lib-beta:test', ['kind-irrelevant']],
    ['unused-entry-edit', 'lib-beta:build', ['reachable-from-entry']],
    ['unused-entry-edit', 'e2e-alpha:e2e', ['declared-dependency', 'dependent-task']],
    ['unused-entry-edit', 'workspace:docs', ['unreachable']],
    ['unused-entry-edit', 'lib-alpha:lint', ['changed-input']],
    ['spec-only-dependency-edit', 'lib-alpha:build', ['unreachable']],
    ['spec-only-dependency-edit', 'lib-alpha:test', ['reachable-from-entry']],
    ['type-only-edit', 'lib-beta:test', ['kind-irrelevant']],
    ['side-effect-target-edit', 'app-beta:build', ['side-effect-import']],
    ['barrel-target-edit', 'app-beta:build', ['reachable-from-entry']],
    ['cycle-edit', 'lib-cycle-a:build', ['cycle']],
    ['tool-edit', 'lib-alpha:build', ['tool-changed']],
    ['tool-edit', 'e2e-alpha:e2e', ['dependent-task']],
    ['root-input-edit', 'workspace:docs', ['changed-input']],
    ['root-input-edit', 'lib-alpha:build', ['unreachable']],
    ['global-config-edit', 'lib-alpha:build', ['global-config']],
    ['renamed-module', 'app-consumer:build', ['reachable-from-entry', 'renamed-module']],
    ['deleted-project-file', 'app-beta:build', ['project-configuration']],
    ['deleted-project-file', 'lib-alpha:build', ['unreachable']],
    ['dynamic-importer-edit', 'app-consumer:build', ['unresolved-import']],
    ['parse-failure', 'app-consumer:build', ['parse-failure']],
    ['deleted-module', 'app-consumer:build', ['deleted-module']],
    ['deleted-module', 'lib-alpha:build', ['changed-input']],
    ['lint-config-edit', 'lib-alpha:lint', ['changed-input']],
    ['lint-config-edit', 'workspace:docs', ['role-irrelevant']],
    ['lint-config-edit', 'lib-alpha:build', ['unreachable']],
    ['re-exported-project-edit', 'lib-delta:build', ['external-re-export']],
    ['re-exported-project-edit', 'lib-alpha:build', ['unreachable']],
    ['renamed-module-dangling', 'app-consumer:build', ['renamed-module']],
    ['deleted-module-rewired', 'app-consumer:build', ['deleted-module', 'reachable-from-entry']],
  ])('%s decides %s by %s', (name, task, rules) => {
    expect(rulesOf(name, task)).toEqual(rules)
  })

  it('names the spec-only edges a skipped build task reaches the changed project through', () => {
    expect(decisionOf('spec-only-dependency-edit', 'lib-alpha:build').messages).toEqual([
      expect.stringContaining('lib-alpha depends on lib-testing only through value spec (1 file), value test-config (1 file)'),
    ])
  })

  it('says when the task reads no dependency inputs', () => {
    expect(decisionOf('unused-entry-edit', 'workspace:docs').messages).toEqual([
      expect.stringContaining('workspace:docs reads no dependency inputs'),
    ])
  })

  it('says when the changed project is no dependency at all', () => {
    expect(decisionOf('root-input-edit', 'lib-alpha:build').messages).toEqual([
      expect.stringContaining('lib-alpha does not depend on workspace'),
    ])
  })

  it('says when a dependency file of an excluded role is reached', () => {
    const item = analyse('unused-entry-edit')
    const graph: WorkspaceGraph = {
      ...item.graph,
      nodes: createMap(
        [...item.graph.nodes].map(([id, node]) => [
          id,
          id === 'file:libs/alpha/src/core.ts' && node.kind === 'file' ? { ...node, role: 'spec' } : node,
        ])
      ),
    }
    const set = selectAffected({ graph, changes: item.changes, targets: ['build'] }).get('build') as AffectedSet
    expect(set.skipped.find((decision) => decision.task === 'lib-beta:build')?.reasons.map((reason) => reason.rule)).toEqual([
      'role-irrelevant',
    ])
  })

  it('reports a renamed module through the current graph alone when the base graph is absent', () => {
    expect(rulesOf('renamed-module', 'app-consumer:build', false)).toEqual(['reachable-from-entry'])
  })

  it('cannot name a deleted module whose importers were rewired without the base graph', () => {
    expect(rulesOf('deleted-module-rewired', 'app-consumer:build', false)).toEqual(['reachable-from-entry'])
  })

  it('counts the files of the groups a skipped task reaches the changed project through', () => {
    expect(decisionOf('unused-entry-edit', 'app-consumer:build').messages).toEqual([
      expect.stringContaining('app-consumer depends on lib-alpha only through value production (2 files)'),
    ])
  })

  it('reports a deleted module through its dangling importers when the base graph is absent', () => {
    expect(rulesOf('deleted-module', 'app-consumer:build', false)).toEqual(['deleted-module'])
  })

  it('skips a changed configuration file of a dependency', () => {
    const item = analyse('unused-entry-edit')
    const changes: ChangeSet = { ...item.changes, changes: [{ status: 'modified', path: 'libs/alpha/project.json', previousPath: null }] }
    const set = selectAffected({ graph: item.graph, changes, targets: ['build'] }).get('build') as AffectedSet
    expect({
      selected: set.selected.map((decision) => decision.task),
      beta: set.skipped.find((decision) => decision.task === 'lib-beta:build')?.reasons.map((reason) => reason.message),
    }).toEqual({
      selected: ['lib-alpha:build'],
      beta: [
        'libs/alpha/project.json does not reach lib-beta:build: libs/alpha/project.json configures lib-alpha alone; lib-beta:build does not read it',
      ],
    })
  })

  it('selects the dependents of a dependency whose manifest changed', () => {
    const item = analyse('unused-entry-edit')
    const changes: ChangeSet = { ...item.changes, changes: [{ status: 'modified', path: 'libs/alpha/package.json', previousPath: null }] }
    const set = selectAffected({ graph: item.graph, changes, targets: ['build'] }).get('build') as AffectedSet
    expect(set.selected.map((decision) => `${decision.task} ${decision.reasons.map((reason) => reason.rule).join(',')}`)).toEqual([
      'app-beta:build dependency-manifest',
      'app-consumer:build dependency-manifest',
      'lib-alpha:build dependency-manifest',
      'lib-beta:build dependency-manifest',
    ])
  })

  it('skips a file no project owns', () => {
    const item = analyse('unused-entry-edit')
    const graph: WorkspaceGraph = { ...item.graph, projectOf: () => null }
    const changes: ChangeSet = { ...item.changes, changes: [{ status: 'deleted', path: 'orphan/file.ts', previousPath: null }] }
    const set = selectAffected({ graph, changes, targets: ['docs'] }).get('docs') as AffectedSet
    expect(set.skipped.map((decision) => decision.reasons.map((reason) => reason.message)).flat()).toEqual([
      expect.stringContaining('no project owns the file'),
    ])
  })
})

describe('inputs naming other projects and tools with an implementation file', () => {
  const root = createGraphWorkspace()
  const graph = workspaceGraph(root)
  const changes: ChangeSet = {
    base: 'base',
    head: null,
    changes: ['apps/app/src/main.ts', 'libs/a/src/index.ts', 'libs/b/src/index.ts', 'tools/tooling/src/executors/build/executor.ts'].map(
      (path) => ({
        status: 'modified' as const,
        path,
        previousPath: null,
      })
    ),
  }
  const sets = selectAffected({ graph, changes, targets: ['test', 'build', 'version'] })

  /**
   * The rules and evidence of one task's reasons.
   *
   * @param target - The target decided
   * @param task - The task id
   * @returns One `rule file: message` line per reason
   */
  function reasonsOf(target: string, task: string): string[] {
    const set = sets.get(target) as AffectedSet
    return (set.selected.find((decision) => decision.task === task)?.reasons ?? []).map(
      (reason) => `${reason.rule} ${reason.file ?? ''}: ${reason.message}`
    )
  }

  it('select a task through a projects input, a workspace-rooted glob naming another project, and a tool without an implementation file', () => {
    expect(reasonsOf('test', 'lib-a:test')).toEqual([
      'changed-input apps/app/src/main.ts: apps/app/src/main.ts is an input of lib-a:test (targets.test.inputs in libs/a/project.json)',
      'changed-input libs/a/src/index.ts: libs/a/src/index.ts is an input of lib-a:test (production file of lib-a)',
      'changed-input libs/b/src/index.ts: libs/b/src/index.ts is an input of lib-a:test (projects input naming @fixture/b)',
      'tool-changed tools/tooling/src/executors/build/executor.ts: tools/tooling/src/executors/build/executor.ts reaches lib-a:test: lib-a:test runs @fixture/tooling:test, implemented by tooling',
    ])
  })

  it('select every task of a tool through the closure of its implementation file', () => {
    expect(reasonsOf('build', 'lib-d:build')).toEqual(
      expect.arrayContaining([
        'tool-changed tools/tooling/src/executors/build/executor.ts: tools/tooling/src/executors/build/executor.ts reaches lib-d:build: lib-d:build runs @fixture/tooling:build, implemented by tooling',
      ])
    )
  })

  it('leave an installed tool out of the tool reach', () => {
    expect(reasonsOf('version', 'lib-a:version').map((line) => line.slice(0, line.indexOf(' ')))).toEqual(['changed-input', 'cycle'])
  })

  it('remove the workspace at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(sets.size).toBe(3)
  })
})

describe('the fallbacks', () => {
  it('list the unresolved loads, dangling imports and parse failures the closures met, once each', () => {
    const item = analyse('deleted-module')
    const set = selectAffected({ graph: item.graph, changes: item.changes, targets: ['build'] }).get('build') as AffectedSet
    expect(set.fallbacks.map((reason) => `${reason.rule} ${reason.file}`)).toEqual([
      'deleted-module libs/alpha/src/core.ts',
      'deleted-module libs/alpha/src/extra/extra-impl.ts',
      'unresolved-import apps/consumer/src/loader.ts',
      'unresolved-import libs/gamma/src/index.ts',
    ])
  })
})

describe('a dangling import of a module that never existed', () => {
  it('is reported as unresolved rather than deleted', () => {
    const item = analyse('dangling-import-added')
    const set = selectAffected({ graph: item.graph, changes: item.changes, targets: ['build'] }).get('build') as AffectedSet
    expect(set.fallbacks.map((reason) => `${reason.rule} ${reason.file}`)).toEqual(
      expect.arrayContaining(['unresolved-import libs/alpha/src/core.ts'])
    )
  })
})

describe('dependsOn', () => {
  it('decides the target a task depends on as well', () => {
    const item = analyse('unused-entry-edit')
    expect([...selectAffected({ graph: item.graph, changes: item.changes, targets: ['e2e'] }).keys()]).toEqual(['build', 'e2e'])
  })

  it("follows another project's target and the same target of the dependencies", () => {
    const item = analyse('unused-entry-edit')
    const configured = (name: string, dependsOn: readonly unknown[]): WorkspaceGraph['projects'] => {
      const project = item.graph.projects.get(name)
      if (project === undefined) return item.graph.projects
      const targets = { ...project.configuration?.targets, e2e: { dependsOn } }
      return createMap(
        [...item.graph.projects].map(([key, value]) => [
          key,
          key === name ? { ...value, configuration: { ...value.configuration, targets } } : value,
        ])
      )
    }
    const graph: WorkspaceGraph = {
      ...item.graph,
      projects: configured('app-consumer', ['lib-alpha:build', '^e2e']),
    }
    const set = selectAffected({ graph, changes: item.changes, targets: ['e2e'] }).get('e2e') as AffectedSet
    const dependent = (reasons: readonly { rule: string; path: readonly string[] }[]): string =>
      reasons
        .filter((reason) => reason.rule === 'dependent-task')
        .map((reason) => reason.path[0])
        .join(',')
    expect(set.selected.map((decision) => `${decision.task} ${dependent(decision.reasons)}`)).toEqual([
      'app-consumer:e2e task:lib-alpha:build',
      'e2e-alpha:e2e task:lib-alpha:build',
    ])
  })

  it('follows a project:target string to the task of the project it names', () => {
    const item = analyse('unused-entry-edit')
    const projects = createMap(
      [...item.graph.projects].map(([key, value]) =>
        key === 'app-consumer'
          ? [
              key,
              {
                ...value,
                configuration: {
                  ...value.configuration,
                  targets: { ...value.configuration?.targets, e2e: { dependsOn: ['lib-alpha:test'] } },
                },
              },
            ]
          : [key, value]
      )
    )
    const set = selectAffected({ graph: { ...item.graph, projects }, changes: item.changes, targets: ['e2e'] }).get('e2e') as AffectedSet
    expect(
      set.selected
        .find((decision) => decision.task === 'app-consumer:e2e')
        ?.reasons.filter((reason) => reason.rule === 'dependent-task')
        .map((reason) => `${reason.path.join(' ')}: ${reason.message}`)
    ).toEqual(['task:lib-alpha:test: app-consumer:e2e runs after lib-alpha:test, which is selected'])
  })

  it('follows a dependency on the same target of the dependencies, selected or not', () => {
    const item = analyse('unused-entry-edit')
    const projects = createMap(
      [...item.graph.projects].map(([key, value]) =>
        key === 'app-consumer' || key === 'lib-cycle-a'
          ? [
              key,
              {
                ...value,
                configuration: { ...value.configuration, targets: { ...value.configuration?.targets, build: { dependsOn: ['^build'] } } },
              },
            ]
          : [key, value]
      )
    )
    const set = selectAffected({ graph: { ...item.graph, projects }, changes: item.changes, targets: ['build'] }).get(
      'build'
    ) as AffectedSet
    expect({
      consumer: set.selected.find((decision) => decision.task === 'app-consumer:build')?.reasons.map((reason) => reason.rule),
      cycle: set.skipped.some((decision) => decision.task === 'lib-cycle-a:build'),
    }).toEqual({ consumer: ['dependent-task'], cycle: true })
  })

  it('treats a target whose dependency is itself still being decided as unselected', () => {
    const item = analyse('unused-entry-edit')
    const projects = createMap(
      [...item.graph.projects].map(([key, value]) =>
        key === 'lib-alpha'
          ? [
              key,
              {
                ...value,
                configuration: {
                  ...value.configuration,
                  targets: { ...value.configuration?.targets, build: { dependsOn: ['test'] }, test: { dependsOn: ['build'] } },
                },
              },
            ]
          : [key, value]
      )
    )
    const graph: WorkspaceGraph = { ...item.graph, projects }
    const sets = selectAffected({ graph, changes: item.changes, targets: ['build'] })
    expect(
      (sets.get('build') as AffectedSet).selected
        .find((decision) => decision.task === 'lib-alpha:build')
        ?.reasons.map((reason) => reason.rule)
    ).toEqual(['changed-input', 'dependent-task'])
  })
})
