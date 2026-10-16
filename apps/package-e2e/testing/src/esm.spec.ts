/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/testing`
 * Tests that the packed package is importable, that every entry carries its documented
 * surface, and that the installed preloads, runner and reporter work from a consumer's seat.
 */

import type { FileCoverage } from '@hyperfrontend/testing/coverage'
import type { RunOutcome, TestConfig } from '@hyperfrontend/testing/runner'
import type { ChildRun } from './support/installed-package'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  PROJECT_DIR,
  fixtureDir,
  installedPath,
  installedUrl,
  runChildSuite,
  tapCount,
  withoutHarnessEnvironment,
} from './support/installed-package'

const ENTRIES = ['', 'coverage', 'dom', 'hooks', 'reporter', 'runner']
const MAIN_EXPORTS = ['describe', 'equals', 'expect', 'it', 'jest', 'matchesSubset']
const IT_MODIFIERS = ['each', 'only', 'skip', 'todo', 'concurrent', 'failing']
const DESCRIBE_MODIFIERS = ['each', 'only', 'skip']
const EXPECT_STATICS = [
  'any',
  'anything',
  'objectContaining',
  'arrayContaining',
  'stringContaining',
  'stringMatching',
  'closeTo',
  'assertions',
  'hasAssertions',
]
const EXPECT_NEGATIONS = ['objectContaining', 'arrayContaining', 'stringContaining', 'stringMatching']
const JEST_METHODS = [
  'fn',
  'spyOn',
  'mocked',
  'clearAllMocks',
  'resetAllMocks',
  'restoreAllMocks',
  'useFakeTimers',
  'useRealTimers',
  'advanceTimersByTime',
  'advanceTimersByTimeAsync',
  'runAllTimers',
  'runOnlyPendingTimers',
  'clearAllTimers',
  'setSystemTime',
  'resetModules',
  'mock',
  'unmock',
  'doMock',
  'requireActual',
  'requireMock',
]
const RUNNER_FUNCTIONS = ['runProjectTests', 'buildRunPlan', 'withDefaults']
const BASELINE_EXCLUDE = ['**/*.spec.ts', '**/*.spec.tsx', '**/*.d.ts', 'test.config.ts']
const COVERAGE_EXPORTS = [
  'mergeLcov',
  'renderLcov',
  'findThresholdShortfalls',
  'renderCoverageTable',
  'findUnmeasuredFiles',
  'fileTotals',
  'overallTotals',
  'percentOf',
  'uncoveredRanges',
]
const JEST_STYLE_SPECS = [
  'src/origin.spec.ts',
  'src/mock-factory.spec.ts',
  'src/automock.spec.ts',
  'src/do-mock.spec.ts',
  'src/timers.spec.ts',
  'src/each.spec.ts',
]
const JEST_STYLE_SUITES = [
  'the runtime a fixture imports',
  'jest.mock with a factory',
  'jest.mock automock of a built-in',
  'jest.doMock after jest.resetModules',
  'fake timers',
  'it.each',
]
const COVERAGE_FLAGS = ['--experimental-test-coverage', '--test-coverage-include=src/**/*.ts']
const SAMPLE_LCOV = [
  'TN:',
  'SF:src/sample.ts',
  'FN:1,sample',
  'FNDA:1,sample',
  'FNF:1',
  'FNH:1',
  'BRDA:2,0,0,1',
  'BRDA:2,0,1,-',
  'BRF:2',
  'BRH:1',
  'DA:1,1',
  'DA:2,1',
  'DA:3,0',
  'LF:3',
  'LH:2',
  'end_of_record',
  '',
].join('\n')

type RunResult = RunOutcome & { coverageDir: string }

describe('@hyperfrontend/testing ESM', () => {
  describe('package layout', () => {
    const manifest = JSON.parse(readFileSync(installedPath('package.json'), 'utf8'))

    it('maps the six entries and the manifest in exports', () => {
      expect(Object.keys(manifest.exports).sort()).toEqual([
        '.',
        './coverage',
        './dom',
        './hooks',
        './package.json',
        './reporter',
        './runner',
      ])
    })

    it('ships an ES module, a CommonJS twin and a declaration for every entry', () => {
      const files = ENTRIES.flatMap((entry) => ['index.mjs', 'index.cjs', 'index.d.ts'].map((file) => join(entry, file)))
      expect(files.filter((file) => !existsSync(installedPath(file)))).toEqual([])
    })

    it('declares no runtime dependencies', () => {
      expect(manifest.dependencies).toBeUndefined()
    })

    it('installs without a node_modules directory of its own', () => {
      expect(existsSync(installedPath('node_modules'))).toBe(false)
    })

    it('names jsdom as an optional peer', () => {
      expect({ peerDependencies: manifest.peerDependencies, peerDependenciesMeta: manifest.peerDependenciesMeta }).toEqual({
        peerDependencies: { jsdom: '>=26.0.0' },
        peerDependenciesMeta: { jsdom: { optional: true } },
      })
    })

    it('requires Node 22.18 or later', () => {
      expect(manifest.engines.node).toBe('>=22.18.0')
    })
  })

  describe('main entry', () => {
    it('exports the Jest-style surface', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(Object.keys(packed).sort()).toEqual(MAIN_EXPORTS)
    })

    it('pulls in neither preload, so no document appears on the global', async () => {
      await import(installedUrl('index.mjs'))
      expect(typeof document).toBe('undefined')
    })

    it('carries an expect of its own, distinct from the workspace runtime this suite runs on', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.expect).not.toBe(expect)
    })

    it('carries an it of its own, distinct from the workspace runtime this suite runs on', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.it).not.toBe(it)
    })

    it('carries the it modifiers', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of IT_MODIFIERS) expect(typeof packed.it[name]).toBe('function')
    })

    it('carries the describe modifiers', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of DESCRIBE_MODIFIERS) expect(typeof packed.describe[name]).toBe('function')
    })

    it('carries the expect statics', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of EXPECT_STATICS) expect(typeof packed.expect[name]).toBe('function')
    })

    it('carries the negations of the expect statics', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of EXPECT_NEGATIONS) expect(typeof packed.expect.not[name]).toBe('function')
    })

    it('carries the jest namespace', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of JEST_METHODS) expect(typeof packed.jest[name]).toBe('function')
    })

    it('exports an equals helper that accepts deeply equal values', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.equals({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    })

    it('exports an equals helper that rejects differing values', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.equals({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('exports a matchesSubset helper that accepts a subset', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.matchesSubset({ a: 1, b: 2 }, { a: 1 })).toBe(true)
    })

    it('exports a matchesSubset helper that rejects an expectation the value does not cover', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.matchesSubset({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })
  })

  describe('installed expect and jest.fn', () => {
    it('matches by identity and, with asymmetric matchers, by structure', async () => {
      const { expect: packed } = await import(installedUrl('index.mjs'))
      packed(1 + 1).toBe(2)
      packed({ id: 7, tags: ['a', 'b'], name: 'x' }).toEqual({
        id: packed.any(Number),
        tags: packed.arrayContaining(['b']),
        name: packed.stringMatching(/^x$/),
      })
      packed({ nested: { kept: true, extra: 1 } }).toEqual({ nested: packed.objectContaining({ kept: true }) })
      packed(0.1 + 0.2).toEqual(packed.closeTo(0.3, 5))
      packed('abc').toEqual(packed.not.stringContaining('z'))
    })

    it('raises a failed toBe as a thrown assertion naming both values', async () => {
      const { expect: packed } = await import(installedUrl('index.mjs'))
      expect(() => packed(1).toBe(2)).toThrow(/expected 1 to be 2/)
    })

    it('raises a failed toEqual against an asymmetric matcher as a thrown assertion', async () => {
      const { expect: packed } = await import(installedUrl('index.mjs'))
      expect(() => packed({ a: 1 }).toEqual({ a: packed.any(String) })).toThrow()
    })

    it('matches what a function throws', async () => {
      const { expect: packed } = await import(installedUrl('index.mjs'))
      packed(() => {
        throw new TypeError('boom')
      }).toThrow('boom')
      packed(() => {
        throw new TypeError('boom')
      }).toThrow(TypeError)
      packed(() => undefined).not.toThrow()
    })

    it('awaits resolves and rejects', async () => {
      const { expect: packed } = await import(installedUrl('index.mjs'))
      await packed(Promise.resolve({ ok: true })).resolves.toEqual({ ok: true })
      await packed(Promise.reject(new Error('nope'))).rejects.toThrow('nope')
    })

    it('inspects the calls recorded on a jest.fn', async () => {
      const { expect: packed, jest: packedJest } = await import(installedUrl('index.mjs'))
      const add = packedJest.fn((left: number, right: number) => left + right)
      add(1, 2)
      add(3, 4)
      packed(add).toHaveBeenCalledTimes(2)
      packed(add).toHaveBeenCalledWith(1, 2)
      packed(add).toHaveBeenLastCalledWith(3, 4)
      packed(add.mock.results.map((result: { value: number }) => result.value)).toEqual([3, 7])
      expect(() => packed(add).toHaveBeenCalledWith(9, 9)).toThrow()
    })

    it('spies on a method and calls through to it', async () => {
      const { expect: packed, jest: packedJest } = await import(installedUrl('index.mjs'))
      const target = { greet: (name: string) => `hello ${name}` }
      const spy = packedJest.spyOn(target, 'greet')
      expect(target.greet('ada')).toBe('hello ada')
      packed(spy).toHaveBeenCalledWith('ada')
    })

    it('restores a spied method to the original', async () => {
      const { jest: packedJest } = await import(installedUrl('index.mjs'))
      const target = { greet: (name: string) => `hello ${name}` }
      const original = target.greet
      const spy = packedJest.spyOn(target, 'greet')
      target.greet('ada')
      spy.mockRestore()
      expect(target.greet).toBe(original)
    })
  })

  describe('installed hooks preload', () => {
    const hooks = installedUrl('hooks', 'index.mjs')
    let suite: ChildRun

    before(() => {
      suite = runChildSuite(fixtureDir('jest-style'), [hooks], JEST_STYLE_SPECS)
    })

    it('exits 0 after a Jest-style suite: module mocks, fake timers, it.each and assertion counts', () => {
      expect(suite.status).toBe(0)
    })

    it('writes nothing to stderr while running the Jest-style suite', () => {
      expect(suite.stderr).toBe('')
    })

    it('passes all 14 tests of the Jest-style suite', () => {
      const totals = { tests: tapCount(suite.stdout, 'tests'), pass: tapCount(suite.stdout, 'pass'), fail: tapCount(suite.stdout, 'fail') }
      expect(totals).toEqual({ tests: 14, pass: 14, fail: 0 })
    })

    it('reports every fixture suite as passed under its own name', () => {
      for (const name of JEST_STYLE_SUITES) expect(suite.stdout).toContain(`- ${name}\n`)
    })

    it('renders it.each titles with %s and %p', () => {
      const titles = ['# Subtest: adds 1 and 2 to make 3', '# Subtest: adds 2 and 3 to make 5', "# Subtest: joins ab and cd into 'abcd'"]
      expect(titles.filter((title) => !suite.stdout.includes(title))).toEqual([])
    })

    describe('when a suite fails', () => {
      let failed: ChildRun

      before(() => {
        failed = runChildSuite(fixtureDir('failing'), [hooks], ['src/failing.spec.ts'])
      })

      it('exits non-zero, so a clean exit is not vacuous', () => {
        expect(failed.status).toBe(1)
      })

      it('counts the failures', () => {
        const totals = {
          tests: tapCount(failed.stdout, 'tests'),
          pass: tapCount(failed.stdout, 'pass'),
          fail: tapCount(failed.stdout, 'fail'),
        }
        expect(totals).toEqual({ tests: 3, pass: 1, fail: 2 })
      })

      it('reports the failing suite as not ok', () => {
        expect(failed.stdout).toContain('not ok 1 - a suite that fails on purpose')
      })
    })
  })

  describe('installed dom preload', () => {
    let domRun: ChildRun

    before(() => {
      domRun = runChildSuite(fixtureDir('dom'), [installedUrl('hooks', 'index.mjs'), installedUrl('dom', 'index.mjs')], ['src/dom.spec.ts'])
    })

    it('gives a suite a document and makes window the global object', () => {
      expect({ pass: tapCount(domRun.stdout, 'pass'), fail: tapCount(domRun.stdout, 'fail') }).toEqual({ pass: 3, fail: 0 })
    })

    it('exits 0 after the suite that needs a document', () => {
      expect(domRun.status).toBe(0)
    })

    it('writes nothing to stderr while running the suite that needs a document', () => {
      expect(domRun.stderr).toBe('')
    })

    it('takes jsdom from the consumer project, which installs the optional peer itself', () => {
      expect(existsSync(join(PROJECT_DIR, 'node_modules', 'jsdom', 'package.json'))).toBe(true)
    })
  })

  describe('installed reporter', () => {
    let reported: ChildRun
    let printed: ChildRun

    before(() => {
      reported = runChildSuite(fixtureDir('project'), [installedUrl('hooks', 'index.mjs')], ['src/math.spec.ts'], {
        reporter: installedUrl('reporter', 'index.mjs'),
        nodeArgs: COVERAGE_FLAGS,
      })
      printed = runChildSuite(fixtureDir('project'), [installedUrl('hooks', 'index.mjs')], ['src/math.spec.ts'], {
        reporter: 'spec',
        nodeArgs: COVERAGE_FLAGS,
      })
    })

    it('exits 0 for a run it reports', () => {
      expect(reported.status).toBe(0)
    })

    it('prints the pass line', () => {
      expect(reported.stdout).toMatch(/\bpass 2\b/)
    })

    it('withholds the coverage block', () => {
      expect(reported.stdout).not.toMatch(/coverage report/)
    })

    it('exits 0 for the very same run under the spec reporter', () => {
      expect(printed.status).toBe(0)
    })

    it('withholds a block that Node prints for the very same run', () => {
      expect(printed.stdout).toMatch(/start of coverage report[\s\S]*end of coverage report/)
    })
  })

  describe('installed runner', () => {
    const coverageDirs: string[] = []

    after(() => {
      for (const dir of coverageDirs) rmSync(dir, { recursive: true, force: true })
    })

    async function run(config: TestConfig): Promise<RunResult> {
      const { runProjectTests } = await import(installedUrl('runner', 'index.mjs'))
      const coverageDir = mkdtempSync(join(tmpdir(), 'hf-testing-e2e-'))
      coverageDirs.push(coverageDir)
      const outcome: RunOutcome = withoutHarnessEnvironment(() =>
        runProjectTests(config, { workspaceRoot: PROJECT_DIR, projectRoot: fixtureDir('project'), coverageDir, silent: true })
      )
      return { ...outcome, coverageDir }
    }

    function passingMathConfig(): TestConfig {
      return {
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/math.ts'],
        coverageThresholds: { lines: 100, branches: 100, functions: 100 },
      }
    }

    function mappedStubConfig(): TestConfig {
      return {
        environments: [{ name: 'node', testMatch: ['src/real.spec.ts'] }],
        coverageInclude: ['src/stub.ts'],
        moduleNameMapper: { '^\\./real$': '<rootDir>/src/stub.ts' },
      }
    }

    it('exports the runner functions', async () => {
      const runner = await import(installedUrl('runner', 'index.mjs'))
      for (const name of RUNNER_FUNCTIONS) expect(typeof runner[name]).toBe('function')
    })

    it('exports the baseline coverage exclusions', async () => {
      const runner = await import(installedUrl('runner', 'index.mjs'))
      expect(runner.BASELINE_COVERAGE_EXCLUDE).toEqual(BASELINE_EXCLUDE)
    })

    it('fills in the default timeout', async () => {
      const { withDefaults } = await import(installedUrl('runner', 'index.mjs'))
      const resolved = withDefaults({ environments: [], coverageInclude: ['src/**/*.ts'], coverageExclude: ['src/generated/**'] })
      expect(resolved.testTimeout).toBe(30_000)
    })

    it('fills in the baseline exclusions ahead of the configured ones', async () => {
      const { withDefaults } = await import(installedUrl('runner', 'index.mjs'))
      const resolved = withDefaults({ environments: [], coverageInclude: ['src/**/*.ts'], coverageExclude: ['src/generated/**'] })
      expect(resolved.coverageExclude).toEqual([...BASELINE_EXCLUDE, 'src/generated/**'])
    })

    it('plans a run around its own installed preloads and reporter', async () => {
      const { buildRunPlan, withDefaults } = await import(installedUrl('runner', 'index.mjs'))
      const config = withDefaults({
        environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true }],
        coverageInclude: ['src/**/*.ts'],
      })
      const plan = buildRunPlan(config, config.environments[0], fixtureDir('project'), join(tmpdir(), 'unused'))
      expect(plan.argv).toEqual(
        expect.arrayContaining([
          installedUrl('hooks', 'index.mjs'),
          installedUrl('dom', 'index.mjs'),
          `--test-reporter=${installedUrl('reporter', 'index.mjs')}`,
          '--experimental-test-coverage',
        ])
      )
    })

    it('passes a project whose tests pass and whose thresholds are met', async () => {
      const outcome = await run(passingMathConfig())
      expect({ success: outcome.success, failures: outcome.failures }).toEqual({ success: true, failures: [] })
    })

    it('tables the source file of a passing project at full coverage', async () => {
      const outcome = await run(passingMathConfig())
      expect(outcome.coverageTable.some((row) => row.startsWith('src/math.ts') && row.includes('100.00'))).toBe(true)
    })

    it('writes the merged lcov.info naming the file from the workspace root', async () => {
      const outcome = await run({ environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }], coverageInclude: ['src/math.ts'] })
      expect(readFileSync(join(outcome.coverageDir, 'lcov.info'), 'utf8')).toContain('SF:src/fixtures/project/src/math.ts\n')
    })

    it('keeps the per-environment lcov.node.info beside the merged report', async () => {
      const outcome = await run({ environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }], coverageInclude: ['src/math.ts'] })
      expect(existsSync(join(outcome.coverageDir, 'lcov.node.info'))).toBe(true)
    })

    it('fails a run that never loaded a file it was asked to measure', async () => {
      const outcome = await run({ environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }], coverageInclude: ['src/**/*.ts'] })
      expect({ success: outcome.success, failureText: outcome.failures.join('\n') }).toEqual({
        success: false,
        failureText: expect.stringMatching(/no test loaded these files[\s\S]*src\/orphan\.ts/),
      })
    })

    it('fails a run whose coverage misses a declared threshold', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/extras.spec.ts'] }],
        coverageInclude: ['src/extras.ts'],
        coverageThresholds: { functions: 100 },
      })
      expect({ success: outcome.success, failures: outcome.failures }).toEqual({
        success: false,
        failures: ['50.00% function coverage does not meet threshold of 100%'],
      })
    })

    it('fails a run whose suite fails, naming the environment', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect({ success: outcome.success, failures: outcome.failures }).toEqual({
        success: false,
        failures: ['environment "node" reported failures'],
      })
    })

    it('preloads a setup module whose jest.mock applies to every spec', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'], setupFiles: ['test.setup.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect({ success: outcome.success, failures: outcome.failures }).toEqual({ success: true, failures: [] })
    })

    it('redirects a specifier through moduleNameMapper, so the spec passes against the stub', async () => {
      const outcome = await run(mappedStubConfig())
      expect({ success: outcome.success, failures: outcome.failures }).toEqual({ success: true, failures: [] })
    })

    it('measures the stub a moduleNameMapper redirect loaded', async () => {
      const outcome = await run(mappedStubConfig())
      expect(outcome.coverageTable.some((row) => row.startsWith('src/stub.ts'))).toBe(true)
    })
  })

  describe('installed coverage entry', () => {
    async function mergeSampleReportTwice(): Promise<FileCoverage[]> {
      const { mergeLcov } = await import(installedUrl('coverage', 'index.mjs'))
      const dir = mkdtempSync(join(tmpdir(), 'hf-testing-e2e-lcov-'))
      try {
        const report = join(dir, 'lcov.node.info')
        writeFileSync(report, SAMPLE_LCOV)
        return [...mergeLcov([report, report]).values()]
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }

    it('exports the merge, render, gate and completeness functions', async () => {
      const coverage = await import(installedUrl('coverage', 'index.mjs'))
      for (const name of COVERAGE_EXPORTS) expect(typeof coverage[name]).toBe('function')
    })

    it('merges the records of one file into a single record', async () => {
      const files = await mergeSampleReportTwice()
      expect(files.map((file) => file.path)).toStrictEqual(['src/sample.ts'])
    })

    it('totals the lines, branches and functions of a merged record', async () => {
      const { fileTotals } = await import(installedUrl('coverage', 'index.mjs'))
      const files = await mergeSampleReportTwice()
      expect(fileTotals(files[0])).toEqual({ lines: { found: 3, hit: 2 }, branches: { found: 2, hit: 1 }, functions: { found: 1, hit: 1 } })
    })

    it('expresses the overall line total as a percentage', async () => {
      const { overallTotals, percentOf } = await import(installedUrl('coverage', 'index.mjs'))
      const files = await mergeSampleReportTwice()
      expect(percentOf(overallTotals(files).lines)).toBeCloseTo(66.67, 1)
    })

    it('lists the uncovered lines of a merged record as ranges', async () => {
      const { uncoveredRanges } = await import(installedUrl('coverage', 'index.mjs'))
      const files = await mergeSampleReportTwice()
      expect(uncoveredRanges(files[0])).toEqual(['3'])
    })

    it('gates the merged totals against their thresholds', async () => {
      const { findThresholdShortfalls } = await import(installedUrl('coverage', 'index.mjs'))
      const files = await mergeSampleReportTwice()
      expect(findThresholdShortfalls(files, { lines: 100, functions: 100 })).toEqual([
        '66.67% line coverage does not meet threshold of 100%',
      ])
    })

    it('renders the merged record back out as lcov with the hits summed', async () => {
      const { renderLcov } = await import(installedUrl('coverage', 'index.mjs'))
      const files = await mergeSampleReportTwice()
      expect(renderLcov(files)).toContain('DA:1,2\n')
    })

    it('renders a coverage table row for the merged file', async () => {
      const { renderCoverageTable } = await import(installedUrl('coverage', 'index.mjs'))
      const table = renderCoverageTable(await mergeSampleReportTwice())
      expect(table.some((row: string) => row.startsWith('src/sample.ts'))).toBe(true)
    })

    it('renders the all files row second to last in the coverage table', async () => {
      const { renderCoverageTable } = await import(installedUrl('coverage', 'index.mjs'))
      const table = renderCoverageTable(await mergeSampleReportTwice())
      expect(table[table.length - 2]).toMatch(/^all files/)
    })

    it('lists the files a report never measured', async () => {
      const { findUnmeasuredFiles } = await import(installedUrl('coverage', 'index.mjs'))
      const { missing, covered } = findUnmeasuredFiles([], fixtureDir('project'), ['src/**/*.ts'], ['**/*.spec.ts'])
      expect({ covered, missing }).toEqual({ covered: 0, missing: expect.arrayContaining(['src/orphan.ts']) })
    })

    it('leaves files matching an exclusion off the unmeasured list', async () => {
      const { findUnmeasuredFiles } = await import(installedUrl('coverage', 'index.mjs'))
      const { missing } = findUnmeasuredFiles([], fixtureDir('project'), ['src/**/*.ts'], ['**/*.spec.ts'])
      expect(missing.filter((file: string) => file.endsWith('.spec.ts'))).toEqual([])
    })
  })
})
