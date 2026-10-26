import type { Plan } from './model'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createPipelineWorkspace, modified } from './__test-utils__/workspace'
import { CI_TARGETS, createPlan } from './plan'

const workspace = createPipelineWorkspace()
const { graph } = workspace

afterAll(() => workspace.remove())

/**
 * The chains of a plan as one line each.
 *
 * @param plan - The plan described
 * @returns `<environment> <project>: <targets>` per chain, in scheduling order
 */
function chains(plan: Plan): string[] {
  return plan.chains.map((chain) => `${chain.environment} ${chain.project}: ${chain.tasks.map((task) => task.target).join(' ')}`)
}

describe('createPlan', () => {
  it('selects the pipeline targets by default', () => {
    expect([...CI_TARGETS]).toEqual(['typecheck', 'lint', 'test', 'build', 'e2e'])
  })

  it('plans every task of every project when there is no change set', () => {
    expect(chains(createPlan({ graph, changes: null, main: false }))).toEqual([
      'linux lib-beta: typecheck lint test build e2e probe',
      'linux lib-alpha: typecheck lint test build e2e probe smoke-floor smoke-major',
      'windows lib-alpha: typecheck lint test build smoke-floor smoke-major',
      'linux lib-testing: typecheck lint test build',
      'windows lib-beta: typecheck lint test',
      'windows lib-testing: typecheck lint test',
      'linux tool-ling: typecheck lint test',
      'windows tool-ling: typecheck lint test',
      'linux app-site: typecheck lint build',
      'linux e2e-beta: lint',
      'linux e2e-alpha: lint',
      'linux e2e-orphan: lint e2e',
      'linux demo-one: typecheck build',
      'linux workspace: lint',
    ])
  })

  it('describes a full plan', () => {
    const plan = createPlan({ graph, changes: null, main: false })
    expect({ base: plan.base, head: plan.head, mode: plan.mode, environments: plan.environments, skipped: plan.skipped }).toEqual({
      base: 'all',
      head: null,
      mode: 'all',
      environments: ['linux', 'windows'],
      skipped: [],
    })
  })

  it('plans the tasks a change reaches', () => {
    expect(chains(createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: false }))).toEqual([
      'linux lib-beta: typecheck lint test build e2e probe',
      'windows lib-beta: typecheck lint test',
      'linux app-site: typecheck build',
    ])
  })

  it('lists what the change does not reach, with the rule that makes the skip safe', () => {
    const plan = createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: false })
    expect(plan.skipped.find((item) => item.task === 'lib-alpha:build')?.reasons.map((reason) => reason.rule)).toEqual(['unreachable'])
  })

  it('describes an affected plan', () => {
    const plan = createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: false })
    expect({ base: plan.base, head: plan.head, mode: plan.mode, environments: plan.environments, main: plan.main }).toEqual({
      base: 'base-revision',
      head: null,
      mode: 'affected',
      environments: ['linux', 'windows'],
      main: false,
    })
  })

  it('plans the publishes on main', () => {
    expect(chains(createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: true }))).toEqual([
      'linux lib-beta: typecheck lint test build e2e probe publish',
      'windows lib-beta: typecheck lint test',
      'linux app-site: typecheck build',
    ])
  })

  it('takes the selection of an overridden target from Nx', () => {
    const plan = createPlan({
      graph,
      changes: modified('libs/beta/src/index.ts'),
      main: false,
      override: ['test'],
      nxAffected: () => ['lib-alpha'],
    })
    expect(chains(plan)).toEqual([
      'linux lib-beta: typecheck lint build e2e probe',
      'windows lib-beta: typecheck lint',
      'linux lib-alpha: test',
      'windows lib-alpha: test',
      'linux app-site: typecheck build',
    ])
  })

  it('records the override on the tasks and on the skips', () => {
    const plan = createPlan({
      graph,
      changes: modified('libs/beta/src/index.ts'),
      main: false,
      override: ['test'],
      nxAffected: () => ['lib-alpha'],
    })
    const selected = plan.chains.find((chain) => chain.project === 'lib-alpha')?.tasks[0]?.reasons.map((reason) => reason.message)
    const skipped = plan.skipped.find((item) => item.task === 'lib-beta:test')?.reasons.map((reason) => reason.message)
    expect({ override: plan.override, selected, skipped }).toEqual({
      override: ['test'],
      selected: ['nx selected lib-alpha for test'],
      skipped: ['nx did not select lib-beta for test'],
    })
  })

  it('selects nothing for an overridden target without a selector', () => {
    expect(chains(createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: false, override: ['test'] }))).toEqual([
      'linux lib-beta: typecheck lint build e2e probe',
      'windows lib-beta: typecheck lint',
      'linux app-site: typecheck build',
    ])
  })

  it('ignores an overridden target that is not planned', () => {
    expect(
      chains(createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: false, targets: ['build'], override: ['docs'] }))
    ).toEqual(['linux lib-beta: build probe', 'linux app-site: build'])
  })

  it('adds the whole chain of a drifted library on main', () => {
    const plan = createPlan({ graph, changes: modified('README.md'), main: true, drift: ['lib-alpha', 'lib-testing', 'lib-nobody'] })
    expect({ chains: chains(plan), drift: plan.drift }).toEqual({
      chains: [
        'linux lib-alpha: typecheck lint test build e2e probe smoke-floor smoke-major publish',
        'windows lib-alpha: typecheck lint test build smoke-floor smoke-major',
        'linux workspace: lint',
      ],
      drift: ['lib-alpha', 'lib-nobody', 'lib-testing'],
    })
  })

  it('names the registry drift as the reason', () => {
    const plan = createPlan({ graph, changes: modified('README.md'), main: true, drift: ['lib-alpha'] })
    expect(
      plan.chains[0]?.tasks.find((task) => task.target === 'publish')?.reasons.map((reason) => `${reason.rule}: ${reason.message}`)
    ).toEqual(['registry-drift: the registry lacks @fixture/alpha@1.2.0'])
  })

  it('ignores the drift off main', () => {
    expect(createPlan({ graph, changes: modified('README.md'), main: false, drift: ['lib-alpha'] }).drift).toEqual([])
  })

  it('lists no environment when nothing runs', () => {
    const plan = createPlan({ graph, changes: { base: 'b', head: null, changes: [] }, main: false })
    expect({ chains: plan.chains, environments: plan.environments }).toEqual({ chains: [], environments: [] })
  })
})
