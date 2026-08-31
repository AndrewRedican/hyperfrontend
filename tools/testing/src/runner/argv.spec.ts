import type { TestConfig } from './config'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRunPlan, serialiseModuleMap } from './argv'
import { BASELINE_COVERAGE_EXCLUDE, withDefaults } from './config'

const WORKSPACE = '/workspace'
const PROJECT = '/workspace/libs/example'
const COVERAGE = '/workspace/coverage/libs/example'

const SINGLE: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
}

/**
 * Builds a plan for the first environment of a configuration.
 *
 * @param config - The configuration to plan.
 * @returns The arguments the runner would pass to Node.
 */
function planArgs(config: TestConfig): string[] {
  const resolved = withDefaults(config)
  const environment = resolved.environments[0]
  if (!environment) throw new Error('the fixture must declare an environment')
  return buildRunPlan(resolved, environment, WORKSPACE, PROJECT, COVERAGE).argv
}

describe('withDefaults', () => {
  it('applies the baseline coverage exclusions', () => {
    assert.deepEqual(withDefaults(SINGLE).coverageExclude, BASELINE_COVERAGE_EXCLUDE)
  })

  it('keeps a project own exclusions after the baseline', () => {
    assert.deepEqual(withDefaults({ ...SINGLE, coverageExclude: ['src/models/**'] }).coverageExclude, [
      ...BASELINE_COVERAGE_EXCLUDE,
      'src/models/**',
    ])
  })

  it('defaults the per-test timeout', () => {
    assert.equal(withDefaults(SINGLE).testTimeout, 30_000)
  })

  it('keeps a declared timeout', () => {
    assert.equal(withDefaults({ ...SINGLE, testTimeout: 5_000 }).testTimeout, 5_000)
  })
})

describe('buildRunPlan', () => {
  it('imports the resolution hooks before anything else', () => {
    assert.deepEqual(planArgs(SINGLE).slice(0, 2), ['--import', `${WORKSPACE}/tools/testing/src/hooks/register.ts`])
  })

  it('always enables coverage', () => {
    assert.equal(planArgs(SINGLE).includes('--experimental-test-coverage'), true)
  })

  it('passes each include glob', () => {
    assert.equal(planArgs(SINGLE).includes('--test-coverage-include=src/**/*.ts'), true)
  })

  it('passes each baseline exclusion', () => {
    assert.equal(planArgs(SINGLE).includes('--test-coverage-exclude=**/*.spec.ts'), true)
  })

  it('passes the declared timeout', () => {
    assert.equal(planArgs({ ...SINGLE, testTimeout: 1_000 }).includes('--test-timeout=1000'), true)
  })

  it('omits thresholds when none are declared', () => {
    assert.equal(
      planArgs(SINGLE).some((argument) => argument.startsWith('--test-coverage-lines')),
      false
    )
  })

  it('passes the declared line threshold', () => {
    assert.equal(planArgs({ ...SINGLE, coverageThresholds: { lines: 100 } }).includes('--test-coverage-lines=100'), true)
  })

  it('passes the declared branch threshold', () => {
    assert.equal(planArgs({ ...SINGLE, coverageThresholds: { branches: 96 } }).includes('--test-coverage-branches=96'), true)
  })

  it('passes the declared function threshold', () => {
    assert.equal(planArgs({ ...SINGLE, coverageThresholds: { functions: 98 } }).includes('--test-coverage-functions=98'), true)
  })

  it('imports each setup file', () => {
    const args = planArgs({
      ...SINGLE,
      environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], setupFiles: ['test.setup.ts'] }],
    })
    assert.equal(args.includes(`${PROJECT}/test.setup.ts`), true)
  })

  it('ends with the test globs', () => {
    assert.equal(planArgs(SINGLE).at(-1), 'src/**/*.spec.ts')
  })

  it('writes a single environment to the plain report name', () => {
    const resolved = withDefaults(SINGLE)
    const environment = resolved.environments[0]
    if (!environment) throw new Error('the fixture must declare an environment')
    assert.equal(buildRunPlan(resolved, environment, WORKSPACE, PROJECT, COVERAGE).lcovPath, '../../coverage/libs/example/lcov.info')
  })

  it('names the report after the environment when there are several', () => {
    const config: TestConfig = {
      ...SINGLE,
      environments: [
        { name: 'node', testMatch: ['src/**/*.spec.ts'] },
        { name: 'browser', testMatch: ['src/**/*.browser.spec.ts'] },
      ],
    }
    const resolved = withDefaults(config)
    const environment = resolved.environments[1]
    if (!environment) throw new Error('the fixture must declare two environments')
    assert.equal(
      buildRunPlan(resolved, environment, WORKSPACE, PROJECT, COVERAGE).lcovPath,
      '../../coverage/libs/example/lcov.browser.info'
    )
  })

  it('excludes an environment ignored files from its coverage', () => {
    const args = planArgs({
      ...SINGLE,
      environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['src/**/*.browser.spec.ts'] }],
    })
    assert.equal(args.includes('--test-coverage-exclude=src/**/*.browser.spec.ts'), true)
  })
})

describe('serialiseModuleMap', () => {
  it('returns undefined when no mapping is declared', () => {
    assert.equal(serialiseModuleMap(SINGLE), undefined)
  })

  it('serialises the declared mappings as pairs', () => {
    assert.equal(
      serialiseModuleMap({ ...SINGLE, moduleNameMapper: { '^\\./module-dir$': '<rootDir>/src/module-dir.stub.ts' } }),
      '[["^\\\\./module-dir$","<rootDir>/src/module-dir.stub.ts"]]'
    )
  })
})
