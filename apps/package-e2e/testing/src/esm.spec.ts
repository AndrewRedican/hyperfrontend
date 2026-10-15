/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/testing`
 * Tests that the packed package is importable, that every entry carries its documented
 * surface, and that the installed preloads, runner and reporter work from a consumer's seat.
 */

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
      for (const entry of ENTRIES) {
        expect(existsSync(installedPath(entry, 'index.mjs'))).toBe(true)
        expect(existsSync(installedPath(entry, 'index.cjs'))).toBe(true)
        expect(existsSync(installedPath(entry, 'index.d.ts'))).toBe(true)
      }
    })

    it('carries no runtime dependencies and names jsdom as an optional peer', () => {
      expect(manifest.dependencies).toBeUndefined()
      expect(manifest.peerDependencies).toEqual({ jsdom: '>=26.0.0' })
      expect(manifest.peerDependenciesMeta).toEqual({ jsdom: { optional: true } })
      expect(existsSync(installedPath('node_modules'))).toBe(false)
    })

    it('requires Node 22.18 or later', () => {
      expect(manifest.engines.node).toBe('>=22.18.0')
    })
  })

  describe('main entry', () => {
    it('exports the Jest-style surface and neither preload', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(Object.keys(packed).sort()).toEqual(MAIN_EXPORTS)
      expect(typeof document).toBe('undefined')
    })

    it('is a copy of its own, distinct from the workspace runtime this suite runs on', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.expect).not.toBe(expect)
      expect(packed.it).not.toBe(it)
    })

    it('carries the it and describe modifiers', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of IT_MODIFIERS) expect(typeof packed.it[name]).toBe('function')
      for (const name of DESCRIBE_MODIFIERS) expect(typeof packed.describe[name]).toBe('function')
    })

    it('carries the expect statics and their negations', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of EXPECT_STATICS) expect(typeof packed.expect[name]).toBe('function')
      for (const name of EXPECT_NEGATIONS) expect(typeof packed.expect.not[name]).toBe('function')
    })

    it('carries the jest namespace', async () => {
      const packed = await import(installedUrl('index.mjs'))
      for (const name of JEST_METHODS) expect(typeof packed.jest[name]).toBe('function')
    })

    it('exports the equality helpers behind the matchers', async () => {
      const packed = await import(installedUrl('index.mjs'))
      expect(packed.equals({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
      expect(packed.equals({ a: 1 }, { a: 2 })).toBe(false)
      expect(packed.matchesSubset({ a: 1, b: 2 }, { a: 1 })).toBe(true)
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

    it('raises a failed matcher as a thrown assertion', async () => {
      const { expect: packed } = await import(installedUrl('index.mjs'))
      expect(() => packed(1).toBe(2)).toThrow(/expected 1 to be 2/)
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

    it('spies on a method, calls through, and restores it', async () => {
      const { expect: packed, jest: packedJest } = await import(installedUrl('index.mjs'))
      const target = { greet: (name: string) => `hello ${name}` }
      const original = target.greet
      const spy = packedJest.spyOn(target, 'greet')
      expect(target.greet('ada')).toBe('hello ada')
      packed(spy).toHaveBeenCalledWith('ada')
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

    it('runs a Jest-style suite to completion: module mocks, fake timers, it.each and assertion counts', () => {
      expect(suite.stderr).toBe('')
      expect(suite.status).toBe(0)
      expect(tapCount(suite.stdout, 'tests')).toBe(14)
      expect(tapCount(suite.stdout, 'pass')).toBe(14)
      expect(tapCount(suite.stdout, 'fail')).toBe(0)
    })

    it('reports every fixture suite as passed under its own name', () => {
      for (const name of JEST_STYLE_SUITES) expect(suite.stdout).toContain(`- ${name}\n`)
    })

    it('renders it.each titles with %s and %p', () => {
      expect(suite.stdout).toContain('# Subtest: adds 1 and 2 to make 3')
      expect(suite.stdout).toContain('# Subtest: adds 2 and 3 to make 5')
      expect(suite.stdout).toContain("# Subtest: joins ab and cd into 'abcd'")
    })

    it('exits non-zero and counts the failures when a suite fails, so a clean exit is not vacuous', () => {
      const run = runChildSuite(fixtureDir('failing'), [hooks], ['src/failing.spec.ts'])
      expect(run.status).toBe(1)
      expect(tapCount(run.stdout, 'tests')).toBe(3)
      expect(tapCount(run.stdout, 'pass')).toBe(1)
      expect(tapCount(run.stdout, 'fail')).toBe(2)
      expect(run.stdout).toContain('not ok 1 - a suite that fails on purpose')
    })
  })

  describe('installed dom preload', () => {
    it('gives a suite a document and makes window the global object', () => {
      const run = runChildSuite(
        fixtureDir('dom'),
        [installedUrl('hooks', 'index.mjs'), installedUrl('dom', 'index.mjs')],
        ['src/dom.spec.ts']
      )
      expect(run.stderr).toBe('')
      expect(run.status).toBe(0)
      expect(tapCount(run.stdout, 'pass')).toBe(3)
      expect(tapCount(run.stdout, 'fail')).toBe(0)
    })

    it('takes jsdom from the consumer project, which installs the optional peer itself', () => {
      expect(existsSync(join(PROJECT_DIR, 'node_modules', 'jsdom', 'package.json'))).toBe(true)
    })
  })

  describe('installed reporter', () => {
    it('prints the pass line and withholds the coverage block', () => {
      const run = runChildSuite(fixtureDir('project'), [installedUrl('hooks', 'index.mjs')], ['src/math.spec.ts'], {
        reporter: installedUrl('reporter', 'index.mjs'),
        nodeArgs: COVERAGE_FLAGS,
      })
      expect(run.status).toBe(0)
      expect(run.stdout).toMatch(/\bpass 2\b/)
      expect(run.stdout).not.toMatch(/coverage report/)
    })

    it('withholds a block that Node prints for the very same run', () => {
      const run = runChildSuite(fixtureDir('project'), [installedUrl('hooks', 'index.mjs')], ['src/math.spec.ts'], {
        reporter: 'spec',
        nodeArgs: COVERAGE_FLAGS,
      })
      expect(run.status).toBe(0)
      expect(run.stdout).toMatch(/start of coverage report/)
      expect(run.stdout).toMatch(/end of coverage report/)
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

    it('exports the runner surface', async () => {
      const runner = await import(installedUrl('runner', 'index.mjs'))
      for (const name of RUNNER_FUNCTIONS) expect(typeof runner[name]).toBe('function')
      expect(runner.BASELINE_COVERAGE_EXCLUDE).toEqual(BASELINE_EXCLUDE)
    })

    it('fills in the baseline exclusions and the default timeout', async () => {
      const { withDefaults } = await import(installedUrl('runner', 'index.mjs'))
      const resolved = withDefaults({ environments: [], coverageInclude: ['src/**/*.ts'], coverageExclude: ['src/generated/**'] })
      expect(resolved.testTimeout).toBe(30_000)
      expect(resolved.coverageExclude).toEqual([...BASELINE_EXCLUDE, 'src/generated/**'])
    })

    it('plans a run around its own installed preloads and reporter', async () => {
      const { buildRunPlan, withDefaults } = await import(installedUrl('runner', 'index.mjs'))
      const config = withDefaults({
        environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true }],
        coverageInclude: ['src/**/*.ts'],
      })
      const plan = buildRunPlan(config, config.environments[0], fixtureDir('project'), join(tmpdir(), 'unused'))
      expect(plan.argv).toContain(installedUrl('hooks', 'index.mjs'))
      expect(plan.argv).toContain(installedUrl('dom', 'index.mjs'))
      expect(plan.argv).toContain(`--test-reporter=${installedUrl('reporter', 'index.mjs')}`)
      expect(plan.argv).toContain('--experimental-test-coverage')
    })

    it('passes a project whose tests pass and whose thresholds are met, tabling its source file', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/math.ts'],
        coverageThresholds: { lines: 100, branches: 100, functions: 100 },
      })
      expect(outcome.failures).toEqual([])
      expect(outcome.success).toBe(true)
      expect(outcome.coverageTable.some((row) => row.startsWith('src/math.ts') && row.includes('100.00'))).toBe(true)
    })

    it('writes the merged lcov.info naming the file from the workspace root', async () => {
      const outcome = await run({ environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }], coverageInclude: ['src/math.ts'] })
      expect(readFileSync(join(outcome.coverageDir, 'lcov.info'), 'utf8')).toContain('SF:src/fixtures/project/src/math.ts\n')
      expect(existsSync(join(outcome.coverageDir, 'lcov.node.info'))).toBe(true)
    })

    it('fails a run that never loaded a file it was asked to measure', async () => {
      const outcome = await run({ environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }], coverageInclude: ['src/**/*.ts'] })
      expect(outcome.success).toBe(false)
      expect(outcome.failures.join('\n')).toMatch(/no test loaded these files[\s\S]*src\/orphan\.ts/)
    })

    it('fails a run whose coverage misses a declared threshold', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/extras.spec.ts'] }],
        coverageInclude: ['src/extras.ts'],
        coverageThresholds: { functions: 100 },
      })
      expect(outcome.success).toBe(false)
      expect(outcome.failures).toEqual(['50.00% function coverage does not meet threshold of 100%'])
    })

    it('fails a run whose suite fails, naming the environment', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect(outcome.success).toBe(false)
      expect(outcome.failures).toEqual(['environment "node" reported failures'])
    })

    it('preloads a setup module whose jest.mock applies to every spec', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'], setupFiles: ['test.setup.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect(outcome.failures).toEqual([])
      expect(outcome.success).toBe(true)
    })

    it('redirects a specifier through moduleNameMapper', async () => {
      const outcome = await run({
        environments: [{ name: 'node', testMatch: ['src/real.spec.ts'] }],
        coverageInclude: ['src/stub.ts'],
        moduleNameMapper: { '^\\./real$': '<rootDir>/src/stub.ts' },
      })
      expect(outcome.failures).toEqual([])
      expect(outcome.success).toBe(true)
      expect(outcome.coverageTable.some((row) => row.startsWith('src/stub.ts'))).toBe(true)
    })
  })

  describe('installed coverage entry', () => {
    it('exports the merge, render, gate and completeness functions', async () => {
      const coverage = await import(installedUrl('coverage', 'index.mjs'))
      for (const name of COVERAGE_EXPORTS) expect(typeof coverage[name]).toBe('function')
    })

    it('merges the records of one file, totals them, gates them and renders them back out', async () => {
      const { mergeLcov, fileTotals, overallTotals, percentOf, uncoveredRanges, renderLcov, renderCoverageTable, findThresholdShortfalls } =
        await import(installedUrl('coverage', 'index.mjs'))
      const dir = mkdtempSync(join(tmpdir(), 'hf-testing-e2e-lcov-'))
      const report = join(dir, 'lcov.node.info')
      writeFileSync(report, SAMPLE_LCOV)

      const files = [...mergeLcov([report, report]).values()]
      expect(files).toHaveLength(1)
      expect(files[0].path).toBe('src/sample.ts')
      expect(fileTotals(files[0])).toEqual({ lines: { found: 3, hit: 2 }, branches: { found: 2, hit: 1 }, functions: { found: 1, hit: 1 } })
      expect(percentOf(overallTotals(files).lines)).toBeCloseTo(66.67, 1)
      expect(uncoveredRanges(files[0])).toEqual(['3'])
      expect(findThresholdShortfalls(files, { lines: 100, functions: 100 })).toEqual([
        '66.67% line coverage does not meet threshold of 100%',
      ])
      expect(renderLcov(files)).toContain('DA:1,2\n')
      const table = renderCoverageTable(files)
      expect(table.some((row: string) => row.startsWith('src/sample.ts'))).toBe(true)
      expect(table[table.length - 2]).toMatch(/^all files/)

      rmSync(dir, { recursive: true, force: true })
    })

    it('lists the files a report never measured', async () => {
      const { findUnmeasuredFiles } = await import(installedUrl('coverage', 'index.mjs'))
      const { missing, covered } = findUnmeasuredFiles([], fixtureDir('project'), ['src/**/*.ts'], ['**/*.spec.ts'])
      expect(covered).toBe(0)
      expect(missing).toContain('src/orphan.ts')
      expect(missing.some((file: string) => file.endsWith('.spec.ts'))).toBe(false)
    })
  })
})
