import type { TestConfig } from './config'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { runProjectTests } from './run'

const WORKSPACE_ROOT = process.env['HF_TEST_WORKSPACE_ROOT'] ?? process.cwd()

/**
 * A throwaway project the runner can be pointed at.
 */
type Fixture = {
  /** Absolute path to the project root. */
  projectRoot: string
  /** Absolute path to the coverage output directory. */
  coverageDir: string
}

/**
 * Writes a minimal project with the given files.
 *
 * @param files - Project-relative paths mapped to their contents.
 * @returns Where the project and its coverage output live.
 */
function createFixture(files: Record<string, string>): Fixture {
  const projectRoot = mkdtempSync(join(tmpdir(), 'hf-runner-'))

  for (const [relativePath, contents] of Object.entries(files)) {
    mkdirSync(join(projectRoot, relativePath, '..'), { recursive: true })
    writeFileSync(join(projectRoot, relativePath), contents)
  }

  return { projectRoot, coverageDir: join(projectRoot, 'coverage') }
}

/**
 * Runs a fixture project under a single Node environment.
 *
 * @param fixture - The project to run.
 * @param overrides - Configuration applied on top of the defaults.
 * @returns What the run reported.
 */
function run(fixture: Fixture, overrides: Partial<TestConfig> = {}): ReturnType<typeof runProjectTests> {
  return runProjectTests(
    {
      environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
      coverageInclude: ['src/**/*.ts'],
      ...overrides,
    },
    { workspaceRoot: WORKSPACE_ROOT, projectRoot: fixture.projectRoot, coverageDir: fixture.coverageDir, silent: true }
  )
}

const PASSING_SOURCE = 'export const double = (value: number): number => value * 2\n'
const PASSING_SPEC = `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { double } from './double'

it('doubles', () => {
  assert.equal(double(2), 4)
})
`

describe('runProjectTests', () => {
  it('reports success when the suite passes and coverage is complete', () => {
    const fixture = createFixture({ 'src/double.ts': PASSING_SOURCE, 'src/double.spec.ts': PASSING_SPEC })
    const { success, failures } = run(fixture)
    assert.deepEqual({ success, failures }, { success: true, failures: [] })
  })

  it('returns the coverage table for the caller to print', () => {
    const fixture = createFixture({ 'src/double.ts': PASSING_SOURCE, 'src/double.spec.ts': PASSING_SPEC })
    assert.equal(
      run(fixture).coverageTable.some((row) => row.startsWith('src/double.ts')),
      true
    )
  })

  it('counts a module evaluated twice as one file', () => {
    const fixture = createFixture({
      'src/double.ts': PASSING_SOURCE,
      'src/double.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { jest } from '@hyperfrontend/testing'
import { double } from './double'

it('doubles', async () => {
  jest.resetModules()
  const again = await import('./double')
  assert.equal(again.double(double(2)), 8)
})
`,
    })
    assert.equal(run(fixture).coverageTable.filter((row) => row.startsWith('src/double.ts')).length, 1)
  })

  it('reports failure when a test fails', () => {
    const fixture = createFixture({
      'src/double.ts': PASSING_SOURCE,
      'src/double.spec.ts': PASSING_SPEC.replace('double(2), 4', 'double(2), 5'),
    })
    assert.match(run(fixture).failures.join('\n'), /environment "node" reported failures/)
  })

  it('reports failure when a source file no test loaded goes unmeasured', () => {
    const fixture = createFixture({
      'src/double.ts': PASSING_SOURCE,
      'src/orphan.ts': 'export const unused = (): number => 1\n',
      'src/double.spec.ts': PASSING_SPEC,
    })
    assert.match(run(fixture).failures.join('\n'), /src\/orphan\.ts/)
  })

  it('accepts an unmeasured file that the coverage exclusions cover', () => {
    const fixture = createFixture({
      'src/double.ts': PASSING_SOURCE,
      'src/orphan.ts': 'export const unused = (): number => 1\n',
      'src/double.spec.ts': PASSING_SPEC,
    })
    assert.equal(run(fixture, { coverageExclude: ['src/orphan.ts'] }).success, true)
  })

  it('reports failure when coverage falls below a declared threshold', () => {
    const fixture = createFixture({
      'src/double.ts': `${PASSING_SOURCE}export const never = (): number => 0\n`,
      'src/double.spec.ts': PASSING_SPEC,
    })
    assert.equal(run(fixture, { coverageThresholds: { functions: 100 } }).success, false)
  })

  it('accepts coverage that meets a declared threshold', () => {
    const fixture = createFixture({ 'src/double.ts': PASSING_SOURCE, 'src/double.spec.ts': PASSING_SPEC })
    assert.equal(run(fixture, { coverageThresholds: { functions: 100, lines: 100, branches: 100 } }).success, true)
  })

  it('runs every declared environment', () => {
    const fixture = createFixture({
      'src/double.ts': PASSING_SOURCE,
      'src/double.spec.ts': PASSING_SPEC,
      'src/other.ts': 'export const triple = (value: number): number => value * 3\n',
      'src/other.browser.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { triple } from './other'

it('triples', () => {
  assert.equal(triple(2), 6)
})
`,
    })

    const outcome = runProjectTests(
      {
        environments: [
          { name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['src/**/*.browser.spec.ts'] },
          { name: 'browser', testMatch: ['src/**/*.browser.spec.ts'] },
        ],
        coverageInclude: ['src/**/*.ts'],
      },
      { workspaceRoot: WORKSPACE_ROOT, projectRoot: fixture.projectRoot, coverageDir: fixture.coverageDir, silent: true }
    )

    assert.equal(outcome.success, true)
  })

  it('reports every included file as unmeasured when the runner dies before covering anything', () => {
    const fixture = createFixture({
      'src/double.ts': PASSING_SOURCE,
      'src/double.spec.ts': PASSING_SPEC,
      'crash.setup.ts': 'process.exit(3)\n',
    })
    const outcome = run(fixture, { environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], setupFiles: ['crash.setup.ts'] }] })
    assert.match(outcome.failures.join('\n'), /src\/double\.ts/)
  })

  it('redirects a specifier through the module name mapper', () => {
    const fixture = createFixture({
      'src/real.ts': "export const source = (): string => 'real'\n",
      'src/stub.ts': "export const source = (): string => 'stubbed'\n",
      'src/real.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { source } from './real'

it('sees the stub', () => {
  assert.equal(source(), 'stubbed')
})
`,
    })

    assert.equal(
      run(fixture, {
        // why: the redirect means real.ts is never loaded, so the completeness check would correctly flag it.
        coverageExclude: ['src/real.ts'],
        moduleNameMapper: { '^\\./real$': '<rootDir>/src/stub.ts' },
      }).success,
      true
    )
  })

  it('loads a setup file before the suite', () => {
    const fixture = createFixture({
      'src/flag.ts': "export const readFlag = (): string => String((globalThis as Record<string, unknown>)['hfSetupFlag'])\n",
      'src/flag.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { readFlag } from './flag'

it('sees the setup flag', () => {
  assert.equal(readFlag(), 'ready')
})
`,
      'test.setup.ts': ";(globalThis as Record<string, unknown>)['hfSetupFlag'] = 'ready'\n",
    })

    assert.equal(
      run(fixture, { environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], setupFiles: ['test.setup.ts'] }] }).success,
      true
    )
  })

  it('replaces a module a spec declares with jest.mock', () => {
    const fixture = createFixture({
      'src/dep.ts': "export const label = (): string => 'real'\nexport const untouched = (): string => 'kept'\n",
      'src/subject.ts': "import { label, untouched } from './dep'\nexport const describeIt = (): string => `${label()}/${untouched()}`\n",
      'src/subject.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { jest } from '@hyperfrontend/testing'
import { describeIt } from './subject'

jest.mock('./dep', () => {
  const actual = jest.requireActual('./dep')
  return { ...actual, label: () => 'mocked' }
})

it('sees the replacement and keeps the rest', () => {
  assert.equal(describeIt(), 'mocked/kept')
})
`,
    })

    assert.equal(run(fixture, { coverageInclude: ['src/subject.ts'] }).success, true)
  })

  it('replaces a built-in a spec declares with jest.mock', () => {
    const fixture = createFixture({
      'src/subject.ts': "import { basename } from 'node:path'\nexport const name = (): string => basename('/a/b')\n",
      'src/subject.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { jest } from '@hyperfrontend/testing'
import { name } from './subject'

jest.mock('node:path', () => ({ basename: () => 'mocked' }))

it('sees the replacement', () => {
  assert.equal(name(), 'mocked')
})
`,
    })

    assert.equal(run(fixture, { coverageInclude: ['src/subject.ts'] }).success, true)
  })

  it('applies a jest.mock a setup file declares to every spec in the project', () => {
    const fixture = createFixture({
      'src/dep.ts': "export const label = (): string => 'real'\n",
      'src/subject.ts': "import { label } from './dep'\nexport const describeIt = (): string => label()\n",
      'src/first.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { describeIt } from './subject'

it('sees the project-wide replacement', () => {
  assert.equal(describeIt(), 'mocked')
})
`,
      'src/second.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { describeIt } from './subject'

it('sees it too, without declaring anything', () => {
  assert.equal(describeIt(), 'mocked')
})
`,
      'test.setup.ts': `import { jest } from '@hyperfrontend/testing'

jest.mock('./src/dep', () => ({ label: () => 'mocked' }))
`,
    })

    assert.equal(
      run(fixture, {
        coverageInclude: ['src/subject.ts'],
        environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], setupFiles: ['test.setup.ts'] }],
      }).success,
      true
    )
  })

  it('lets a spec override a replacement its setup file declared', () => {
    const fixture = createFixture({
      'src/dep.ts': "export const label = (): string => 'real'\n",
      'src/subject.ts': "import { label } from './dep'\nexport const describeIt = (): string => label()\n",
      'src/subject.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { jest } from '@hyperfrontend/testing'
import { describeIt } from './subject'

jest.mock('./dep', () => ({ label: () => 'spec' }))

it('sees its own replacement rather than the project one', () => {
  assert.equal(describeIt(), 'spec')
})
`,
      'test.setup.ts': `import { jest } from '@hyperfrontend/testing'

jest.mock('./src/dep', () => ({ label: () => 'setup' }))
`,
    })

    assert.equal(
      run(fixture, {
        coverageInclude: ['src/subject.ts'],
        environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], setupFiles: ['test.setup.ts'] }],
      }).success,
      true
    )
  })

  it('installs a DOM for an environment that asks for one', () => {
    const fixture = createFixture({
      'src/subject.ts': "export const tag = (): string => document.createElement('div').tagName\n",
      'src/subject.spec.ts': `import assert from 'node:assert/strict'
import { it } from 'node:test'
import { tag } from './subject'

it('reaches the document', () => {
  assert.equal(tag(), 'DIV')
})
`,
    })

    assert.equal(
      run(fixture, {
        coverageInclude: ['src/subject.ts'],
        environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true }],
      }).success,
      true
    )
  })
})
