import type { Chain } from './model'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createPipelineWorkspace } from './__test-utils__/workspace'
import { dependencyLevels, rankChains } from './order'

const workspace = createPipelineWorkspace()

afterAll(() => workspace.remove())

/**
 * A chain with the named targets.
 *
 * @param project - Which project the chain belongs to
 * @param targets - One task per target
 * @param environment - Where it runs
 * @returns The chain, unranked
 */
function chain(project: string, targets: readonly string[], environment: Chain['environment'] = 'linux'): Chain {
  return {
    project,
    environment,
    order: 0,
    tasks: targets.map((target) => ({
      id: `${project}:${target}`,
      project,
      target,
      environment,
      needs: [],
      weight: 'light',
      reasons: [],
      command: [],
      env: {},
    })),
  }
}

describe('dependencyLevels', () => {
  it('counts the longest chain of edges below each project', () => {
    const levels = dependencyLevels(workspace.graph)
    expect(['lib-alpha', 'lib-beta', 'app-site', 'e2e-alpha'].map((name) => levels.get(name))).toEqual([0, 1, 2, 1])
  })
})

describe('rankChains', () => {
  it('serves built libraries first, deepest first, then other libraries and tools, then applications', () => {
    const ranked = rankChains(workspace.graph, [
      chain('app-site', ['build']),
      chain('lib-alpha', ['build']),
      chain('tool-ling', ['test']),
      chain('lib-beta', ['build']),
      chain('lib-beta', ['test'], 'windows'),
      chain('lib-testing', ['test']),
      chain('demo-one', ['build']),
    ])
    expect(ranked.map((item) => `${item.order} ${item.project} ${item.environment}`)).toEqual([
      '0 lib-beta linux',
      '1 lib-alpha linux',
      '2 lib-beta windows',
      '3 lib-testing linux',
      '4 tool-ling linux',
      '5 app-site linux',
      '6 demo-one linux',
    ])
  })

  it('ranks a chain of a project the graph does not know with the applications', () => {
    expect(rankChains(workspace.graph, [chain('lib-nobody', ['build']), chain('tool-ling', ['test'])]).map((item) => item.project)).toEqual(
      ['tool-ling', 'lib-nobody']
    )
  })
})
