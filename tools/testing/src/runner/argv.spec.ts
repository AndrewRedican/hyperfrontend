import type { TestConfig } from './config'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { buildRunPlan, selectSpecFiles, serialiseModuleMap, serialiseSetupFiles, setupPaths } from './argv'
import { BASELINE_COVERAGE_EXCLUDE, withDefaults } from './config'

const WORKSPACE = '/workspace'
const PROJECT = '/workspace/libs/example'
const COVERAGE = '/workspace/coverage/libs/example'

const SINGLE: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
}

/**
 * A project root holding real spec files, for the cases that expand a glob rather than
 * hand it to Node.
 */
const FIXTURE_ROOT = mkdtempSync(join(tmpdir(), 'hf-selection-'))
mkdirSync(join(FIXTURE_ROOT, 'src'), { recursive: true })
for (const name of ['one.spec.ts', 'two.spec.ts', 'one.browser.spec.ts']) writeFileSync(join(FIXTURE_ROOT, 'src', name), '')

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
    assert.deepEqual(planArgs(SINGLE).slice(1, 3), ['--import', `${WORKSPACE}/tools/testing/src/hooks/register.ts`])
  })

  it('silences the warning Node raises for every typeless TypeScript file', () => {
    assert.equal(planArgs(SINGLE)[0], '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON')
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

  it('never asks Node to enforce a threshold, since it would judge each module evaluation separately', () => {
    assert.equal(
      planArgs({ ...SINGLE, coverageThresholds: { lines: 100, branches: 96, functions: 98 } }).some((argument) =>
        argument.startsWith('--test-coverage-lines=')
      ),
      false
    )
  })

  it('reports through the runner own reporter so Node coverage summary is held back', () => {
    assert.equal(planArgs(SINGLE).includes(`--test-reporter=${WORKSPACE}/tools/testing/src/runner/reporter.ts`), true)
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

  it('names a single environment raw report after the environment', () => {
    const resolved = withDefaults(SINGLE)
    const environment = resolved.environments[0]
    if (!environment) throw new Error('the fixture must declare an environment')
    assert.equal(buildRunPlan(resolved, environment, WORKSPACE, PROJECT, COVERAGE).lcovPath, '../../coverage/libs/example/lcov.node.info')
  })

  it('names each raw report after its environment when there are several', () => {
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
    const config = withDefaults({
      ...SINGLE,
      environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['**/*.browser.spec.ts'] }],
    })
    const environment = config.environments[0]
    if (!environment) throw new Error('the fixture must declare an environment')
    const args = buildRunPlan(config, environment, WORKSPACE, FIXTURE_ROOT, COVERAGE).argv
    assert.equal(args.includes('--test-coverage-exclude=**/*.browser.spec.ts'), true)
  })

  it('ends with the files an environment selection resolved to', () => {
    const config = withDefaults({
      ...SINGLE,
      environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['**/*.browser.spec.ts'] }],
    })
    const environment = config.environments[0]
    if (!environment) throw new Error('the fixture must declare an environment')
    assert.deepEqual(buildRunPlan(config, environment, WORKSPACE, FIXTURE_ROOT, COVERAGE).argv.slice(-2), [
      'src/one.spec.ts',
      'src/two.spec.ts',
    ])
  })

  it('leaves the DOM out of an environment that did not ask for one', () => {
    assert.equal(planArgs(SINGLE).includes(`${WORKSPACE}/tools/testing/src/environment/dom.ts`), false)
  })

  it('installs a DOM after the hooks and before the setup files', () => {
    const args = planArgs({
      ...SINGLE,
      environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true, setupFiles: ['test.setup.ts'] }],
    })
    assert.deepEqual(args.slice(1, 7), [
      '--import',
      `${WORKSPACE}/tools/testing/src/hooks/register.ts`,
      '--import',
      `${WORKSPACE}/tools/testing/src/environment/dom.ts`,
      '--import',
      `${PROJECT}/test.setup.ts`,
    ])
  })
})

describe('selectSpecFiles', () => {
  it('leaves the globs to Node when the environment ignores nothing', () => {
    assert.deepEqual(selectSpecFiles({ name: 'node', testMatch: ['src/**/*.spec.ts'] }, FIXTURE_ROOT), ['src/**/*.spec.ts'])
  })

  it('expands the globs when the environment ignores files, since Node cannot exclude any', () => {
    assert.deepEqual(
      selectSpecFiles({ name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['**/*.browser.spec.ts'] }, FIXTURE_ROOT),
      ['src/one.spec.ts', 'src/two.spec.ts']
    )
  })

  it('refuses to run an environment its exclusions emptied', () => {
    assert.throws(
      () => selectSpecFiles({ name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['**/*.spec.ts'] }, FIXTURE_ROOT),
      /matched no spec files/
    )
  })
})

describe('setupPaths', () => {
  it('returns nothing when the environment declares no setup file', () => {
    assert.deepEqual(setupPaths({ name: 'node', testMatch: [] }, PROJECT), [])
  })

  it('anchors each setup file to the project root', () => {
    assert.deepEqual(setupPaths({ name: 'node', testMatch: [], setupFiles: ['test.setup.ts'] }, PROJECT), [`${PROJECT}/test.setup.ts`])
  })
})

describe('serialiseSetupFiles', () => {
  it('returns undefined when the environment declares none', () => {
    assert.equal(serialiseSetupFiles({ name: 'node', testMatch: [] }, PROJECT), undefined)
  })

  it('renders the absolute path of each setup file', () => {
    assert.equal(
      serialiseSetupFiles({ name: 'node', testMatch: [], setupFiles: ['test.setup.ts'] }, PROJECT),
      JSON.stringify([`${PROJECT}/test.setup.ts`])
    )
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
