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
      'macos lib-beta: typecheck lint test build e2e',
      'windows lib-beta: typecheck lint test build e2e',
      'linux lib-alpha: typecheck lint test build e2e probe smoke-floor smoke-major',
      'macos lib-alpha: typecheck lint test build e2e smoke-floor smoke-major',
      'windows lib-alpha: typecheck lint test build e2e smoke-floor smoke-major',
      'linux lib-testing: typecheck lint test build',
      'macos lib-testing: typecheck lint test build',
      'windows lib-testing: typecheck lint test build',
      'linux tool-ling: typecheck lint test',
      'macos tool-ling: typecheck lint test',
      'windows tool-ling: typecheck lint test',
      'linux app-site: typecheck lint build',
      'linux e2e-beta: lint',
      'linux e2e-alpha: lint',
      'linux e2e-orphan: lint e2e',
      'linux demo-one: install typecheck build verify',
      'linux demo-two: install build',
      'linux workspace: lint',
    ])
  })

  it('plans the build of a project whose project:target prerequisite the change selects, after that prerequisite', () => {
    const plan = createPlan({ graph, changes: modified('apps/demos/one/src/main.ts'), main: false })
    expect(
      plan.chains.flatMap((chain) =>
        chain.tasks.map((task) => `${task.id} after ${task.needs.length === 0 ? 'nothing' : task.needs.join(', ')}`)
      )
    ).toEqual([
      'demo-one:install after nothing',
      'demo-one:typecheck after demo-one:install',
      'demo-one:build after demo-one:install, demo-one:typecheck',
      'demo-one:verify after demo-one:build, demo-one:install',
      'demo-two:install after nothing',
      'demo-two:build after demo-one:verify, demo-two:install',
    ])
  })

  it('gives every e2e task the change reaches the build of its library, and no other build', () => {
    expect(chains(createPlan({ graph, changes: modified('libs/testing/src/index.ts'), main: false }))).toEqual([
      'linux lib-alpha: build e2e probe smoke-floor smoke-major',
      'macos lib-alpha: build e2e smoke-floor smoke-major',
      'windows lib-alpha: build e2e smoke-floor smoke-major',
      'linux lib-testing: typecheck lint test build',
      'macos lib-testing: typecheck lint test build',
      'windows lib-testing: typecheck lint test build',
    ])
  })

  it('describes a full plan', () => {
    const plan = createPlan({ graph, changes: null, main: false })
    expect({ base: plan.base, head: plan.head, mode: plan.mode, environments: plan.environments, skipped: plan.skipped }).toEqual({
      base: 'all',
      head: null,
      mode: 'all',
      environments: ['linux', 'windows', 'macos'],
      skipped: [],
    })
  })

  it('plans the tasks a change reaches', () => {
    expect(chains(createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: false }))).toEqual([
      'linux lib-beta: typecheck lint test build e2e probe',
      'macos lib-beta: typecheck lint test build e2e',
      'windows lib-beta: typecheck lint test build e2e',
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
      environments: ['linux', 'windows', 'macos'],
      main: false,
    })
  })

  it('plans the publishes on main', () => {
    expect(chains(createPlan({ graph, changes: modified('libs/beta/src/index.ts'), main: true }))).toEqual([
      'linux lib-beta: typecheck lint test build e2e probe publish',
      'macos lib-beta: typecheck lint test build e2e',
      'windows lib-beta: typecheck lint test build e2e',
      'linux app-site: typecheck build',
    ])
  })

  it('plans the deploy of a demo last in its chain on main', () => {
    expect(chains(createPlan({ graph, changes: modified('apps/demos/one/src/main.ts'), main: true }))).toEqual([
      'linux demo-one: install typecheck build verify deploy',
      'linux demo-two: install build',
      'linux workspace: provision',
    ])
  })

  it('plans the provision alone on main when only the Railway configuration changed', () => {
    expect(chains(createPlan({ graph, changes: modified('.railway/railway.ts'), main: true }))).toEqual(['linux workspace: provision'])
  })

  it('plans no provision off main when the Railway configuration changed', () => {
    expect(chains(createPlan({ graph, changes: modified('.railway/railway.ts'), main: false }))).toEqual([])
  })

  it('adds the whole chain of a drifted library on main', () => {
    const plan = createPlan({ graph, changes: modified('README.md'), main: true, drift: ['lib-alpha', 'lib-testing', 'lib-nobody'] })
    expect({ chains: chains(plan), drift: plan.drift }).toEqual({
      chains: [
        'linux lib-alpha: typecheck lint test build e2e probe smoke-floor smoke-major publish',
        'macos lib-alpha: typecheck lint test build e2e smoke-floor smoke-major',
        'windows lib-alpha: typecheck lint test build e2e smoke-floor smoke-major',
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
