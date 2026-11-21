import type { AffectedSet, ChangeSet, Reason } from '../selection'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createConsumerWorkspace } from '../__test-utils__/consumer-workspace'
import { workspaceGraph } from '../build'
import { selectAffected } from './select'

const graph = workspaceGraph(createConsumerWorkspace())

/** The projects of the consumer workspace that take `@fixture/kit` from a registry and have a build. */
const INSTALLING = ['bare:build', 'deleted:build', 'site:build', 'spread:build']

/**
 * The decision a change to one file comes to for a target.
 *
 * @param path - The changed file
 * @param target - The target whose tasks are selected or skipped
 * @returns The affected set
 */
function decided(path: string, target: string): AffectedSet {
  const changes: ChangeSet = { base: 'base', head: null, changes: [{ status: 'modified', path, previousPath: null }] }
  return selectAffected({ graph, changes, targets: [target] }).get(target) as AffectedSet
}

/**
 * The tasks a change to one file selects for a target.
 *
 * @param path - The changed file
 * @param target - The target whose tasks are selected
 * @returns The selected task ids
 */
function selected(path: string, target: string): string[] {
  return decided(path, target).selected.map((decision) => decision.task)
}

/**
 * Why a task was skipped for a change to one file.
 *
 * @param path - The changed file
 * @param task - The task id
 * @returns The reasons of its skip
 */
function skipReasons(path: string, task: string): readonly Reason[] | undefined {
  return decided(path, task.slice(task.indexOf(':') + 1)).skipped.find((decision) => decision.task === task)?.reasons
}

describe('a change to a library some projects install from a registry', () => {
  it('selects the builds of the library and of the projects its alias reaches', () => {
    expect(selected('libs/kit/src/index.ts', 'build')).toEqual([
      'absolute:build',
      'broken:build',
      'chain:build',
      'drive:build',
      'holed:build',
      'lib-kit:build',
      'list:build',
      'missing:build',
      'numbered:build',
      'root:build',
      'seed:build',
    ])
  })

  it('selects no build of a project that installs the library for itself', () => {
    expect(selected('libs/kit/src/index.ts', 'build').filter((task) => INSTALLING.includes(task))).toEqual([])
  })

  it('selects the tests the engine loads through the aliases', () => {
    expect(selected('libs/kit/src/index.ts', 'test')).toEqual(['checked:test', 'lib-kit:test'])
  })

  it('selects no build of such a project for the manifest of the library either', () => {
    expect(selected('libs/kit/package.json', 'build').filter((task) => INSTALLING.includes(task))).toEqual([])
  })

  it('says the project does not depend on the library', () => {
    expect(skipReasons('libs/kit/src/index.ts', 'bare:build')).toEqual([
      {
        rule: 'unreachable',
        file: 'libs/kit/src/index.ts',
        path: [],
        message:
          'libs/kit/src/index.ts does not reach bare:build: libs/kit/src/index.ts is not reachable from the files bare:build reads; bare does not depend on lib-kit',
      },
    ])
  })
})
