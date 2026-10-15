/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/testing`
 * Tests that the packed package is requireable, that its CommonJS entries carry the
 * documented surface, and that the CommonJS runner hands Node the ES module preloads.
 */

'use strict'

const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { after } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { PROJECT_DIR, fixtureDir, installedPath, installedUrl, withoutHarnessEnvironment } = require('./support/installed-package')

const MAIN_EXPORTS = ['describe', 'equals', 'expect', 'it', 'jest', 'matchesSubset']
const IT_MODIFIERS = ['each', 'only', 'skip', 'todo', 'concurrent', 'failing']
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
const SAMPLE_LCOV = [
  'TN:',
  'SF:src/sample.ts',
  'FNF:0',
  'FNH:0',
  'BRF:0',
  'BRH:0',
  'DA:1,1',
  'DA:2,0',
  'DA:3,0',
  'LF:3',
  'LH:1',
  'end_of_record',
  '',
].join('\n')

describe('@hyperfrontend/testing CJS', () => {
  describe('package layout', () => {
    const manifest = JSON.parse(readFileSync(installedPath('package.json'), 'utf8'))

    it('points main at the CommonJS build and module at the ES module build', () => {
      expect(manifest.main).toBe('./index.cjs')
      expect(manifest.module).toBe('./index.mjs')
      expect(manifest.types).toBe('./index.d.ts')
    })

    it('resolves the require condition of every entry to a CommonJS file', () => {
      for (const entry of ['.', './coverage', './dom', './hooks', './reporter', './runner']) {
        expect(manifest.exports[entry].require).toMatch(/index\.cjs$/)
        expect(existsSync(installedPath(manifest.exports[entry].require))).toBe(true)
      }
    })
  })

  describe('main entry', () => {
    it('exports the Jest-style surface and neither preload', () => {
      const packed = require(installedPath('index.cjs'))
      expect(Object.keys(packed).sort()).toEqual(MAIN_EXPORTS)
      expect(typeof document).toBe('undefined')
    })

    it('is a copy of its own, distinct from the workspace runtime this suite runs on', () => {
      const packed = require(installedPath('index.cjs'))
      expect(packed.expect).not.toBe(expect)
    })

    it('carries the it modifiers, the expect statics and the jest namespace', () => {
      const packed = require(installedPath('index.cjs'))
      for (const name of IT_MODIFIERS) expect(typeof packed.it[name]).toBe('function')
      for (const name of EXPECT_STATICS) expect(typeof packed.expect[name]).toBe('function')
      for (const name of JEST_METHODS) expect(typeof packed.jest[name]).toBe('function')
    })
  })

  describe('installed expect and jest.fn', () => {
    it('matches by identity, by structure with asymmetric matchers, and on thrown errors', () => {
      const { expect: packed } = require(installedPath('index.cjs'))
      packed(2 * 2).toBe(4)
      packed({ id: 7, tags: ['a', 'b'] }).toEqual({ id: packed.any(Number), tags: packed.arrayContaining(['b']) })
      packed(() => {
        throw new RangeError('out of range')
      }).toThrow('out of range')
      expect(() => packed(1).toBe(2)).toThrow(/expected 1 to be 2/)
    })

    it('awaits resolves and rejects', async () => {
      const { expect: packed } = require(installedPath('index.cjs'))
      await packed(Promise.resolve(3)).resolves.toBe(3)
      await packed(Promise.reject(new Error('nope'))).rejects.toThrow('nope')
    })

    it('inspects the calls recorded on a jest.fn', () => {
      const { expect: packed, jest: packedJest } = require(installedPath('index.cjs'))
      const record = packedJest.fn()
      record('first', 1)
      record('second', 2)
      packed(record).toHaveBeenCalledTimes(2)
      packed(record).toHaveBeenCalledWith('first', 1)
      packed(record).toHaveBeenLastCalledWith('second', 2)
      expect(() => packed(record).toHaveBeenCalledWith('third', 3)).toThrow()
    })
  })

  describe('installed runner', () => {
    const coverageDirs = []

    after(() => {
      for (const dir of coverageDirs) rmSync(dir, { recursive: true, force: true })
    })

    function run(config) {
      const { runProjectTests } = require(installedPath('runner', 'index.cjs'))
      const coverageDir = mkdtempSync(join(tmpdir(), 'hf-testing-e2e-cjs-'))
      coverageDirs.push(coverageDir)
      const outcome = withoutHarnessEnvironment(() =>
        runProjectTests(config, { workspaceRoot: PROJECT_DIR, projectRoot: fixtureDir('project'), coverageDir, silent: true })
      )
      return { ...outcome, coverageDir }
    }

    it('exports the runner surface', () => {
      const runner = require(installedPath('runner', 'index.cjs'))
      for (const name of RUNNER_FUNCTIONS) expect(typeof runner[name]).toBe('function')
      expect(runner.BASELINE_COVERAGE_EXCLUDE).toEqual(BASELINE_EXCLUDE)
    })

    it('locates the ES module preloads and reporter from the CommonJS build', () => {
      const { buildRunPlan, withDefaults } = require(installedPath('runner', 'index.cjs'))
      const config = withDefaults({
        environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true }],
        coverageInclude: ['src/**/*.ts'],
      })
      const plan = buildRunPlan(config, config.environments[0], fixtureDir('project'), join(tmpdir(), 'unused'))
      expect(plan.argv).toContain(installedUrl('hooks', 'index.mjs'))
      expect(plan.argv).toContain(installedUrl('dom', 'index.mjs'))
      expect(plan.argv).toContain(`--test-reporter=${installedUrl('reporter', 'index.mjs')}`)
    })

    it('runs a project to a passing verdict through the preloads it located', () => {
      const outcome = run({
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/math.ts'],
        coverageThresholds: { lines: 100, branches: 100, functions: 100 },
      })
      expect(outcome.failures).toEqual([])
      expect(outcome.success).toBe(true)
      expect(outcome.coverageTable.some((row) => row.startsWith('src/math.ts'))).toBe(true)
      expect(readFileSync(join(outcome.coverageDir, 'lcov.info'), 'utf8')).toContain('SF:src/fixtures/project/src/math.ts\n')
    })

    it('fails a run whose coverage misses a declared threshold', () => {
      const outcome = run({
        environments: [{ name: 'node', testMatch: ['src/extras.spec.ts'] }],
        coverageInclude: ['src/extras.ts'],
        coverageThresholds: { functions: 100 },
      })
      expect(outcome.success).toBe(false)
      expect(outcome.failures).toEqual(['50.00% function coverage does not meet threshold of 100%'])
    })

    it('preloads a setup module whose jest.mock applies to every spec', () => {
      const outcome = run({
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'], setupFiles: ['test.setup.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect(outcome.failures).toEqual([])
      expect(outcome.success).toBe(true)
    })
  })

  describe('installed coverage entry', () => {
    it('exports the merge, render, gate and completeness functions', () => {
      const coverage = require(installedPath('coverage', 'index.cjs'))
      for (const name of COVERAGE_EXPORTS) expect(typeof coverage[name]).toBe('function')
    })

    it('reads a report, totals it and lists its uncovered lines', () => {
      const { mergeLcov, fileTotals, percentOf, uncoveredRanges, findThresholdShortfalls } = require(installedPath('coverage', 'index.cjs'))
      const dir = mkdtempSync(join(tmpdir(), 'hf-testing-e2e-cjs-lcov-'))
      const report = join(dir, 'lcov.node.info')
      writeFileSync(report, SAMPLE_LCOV)

      const files = [...mergeLcov([report]).values()]
      expect(fileTotals(files[0]).lines).toEqual({ found: 3, hit: 1 })
      expect(percentOf(fileTotals(files[0]).lines)).toBeCloseTo(33.33, 1)
      expect(uncoveredRanges(files[0])).toEqual(['2-3'])
      expect(findThresholdShortfalls(files, { lines: 50 })).toEqual(['33.33% line coverage does not meet threshold of 50%'])

      rmSync(dir, { recursive: true, force: true })
    })
  })
})
