/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/testing`.
 *
 * The packed tarball is installed into a consumer outside the workspace, with jsdom beside it as the optional peer a
 * consumer brings, and every test runs under plain Node with no loader hooks: the CommonJS entries carry the
 * documented surface, and the CommonJS runner hands Node the ES module preloads.
 */

'use strict'

const { existsSync, readFileSync } = require('node:fs')
const { join, posix } = require('node:path')
const { before } = require('node:test')
const { pathToFileURL } = require('node:url')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')
const { consumerProjectPath, consumerProjectsTree } = require('./support/consumer-projects')
const {
  BASELINE_EXCLUDE,
  COVERAGE_EXPORTS,
  EXPECT_STATICS,
  IT_MODIFIERS,
  JEST_METHODS,
  MAIN_EXPORTS,
  RUNNER_FUNCTIONS,
} = require('./support/documented-surface')

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

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL, peers: ['jsdom@26.1.0'] })

before(() => consumer.writeTree(consumerProjectsTree()))

/**
 * Names a file inside the installed package.
 *
 * @param {...string} segments - Path segments below the package root.
 * @returns {string} The absolute path.
 */
function installedPath(...segments) {
  return join(consumer.path, 'node_modules', '@hyperfrontend', 'testing', ...segments)
}

/**
 * Runs the installed runner over the `project` consumer in a child, from its CommonJS build, and reports the outcome.
 *
 * @param {object} config - The project's test configuration.
 * @returns {{ success: boolean, failures: string[], coverageTable: string[], lcov: string }} What the run reported and wrote.
 */
function runInstalledRunner(config) {
  return consumer.run(
    async (args) => {
      const { runProjectTests } = require('@hyperfrontend/testing/runner')
      const { existsSync: exists, mkdtempSync, readFileSync: read, rmSync } = require('node:fs')
      const { tmpdir } = require('node:os')
      const { join: joinPath } = require('node:path')
      const coverageDir = mkdtempSync(joinPath(tmpdir(), 'hf-testing-e2e-cjs-'))
      try {
        const outcome = runProjectTests(args.config, {
          workspaceRoot: args.workspaceRoot,
          projectRoot: args.projectRoot,
          coverageDir,
          silent: true,
        })
        const lcovPath = joinPath(coverageDir, 'lcov.info')
        return {
          success: outcome.success,
          failures: outcome.failures,
          coverageTable: outcome.coverageTable,
          lcov: exists(lcovPath) ? read(lcovPath, 'utf8') : '',
        }
      } finally {
        rmSync(coverageDir, { recursive: true, force: true })
      }
    },
    {
      kind: 'require',
      args: { config, workspaceRoot: consumer.path, projectRoot: join(consumer.path, consumerProjectPath('project')) },
      timeout: 300_000,
    }
  )
}

describe('@hyperfrontend/testing CJS', () => {
  describe('package layout', () => {
    it('points main at the CommonJS build, module at the ES module build and types at the declarations', () => {
      const manifest = JSON.parse(readFileSync(installedPath('package.json'), 'utf8'))
      expect({ main: manifest.main, module: manifest.module, types: manifest.types }).toEqual({
        main: './index.cjs',
        module: './index.mjs',
        types: './index.d.ts',
      })
    })

    it('resolves the require condition of every entry to a CommonJS file', () => {
      const manifest = JSON.parse(readFileSync(installedPath('package.json'), 'utf8'))
      const entries = ['.', './browser', './consumer', './coverage', './dom', './fs', './hooks', './process', './reporter', './runner']
      const resolved = entries.map((entry) => {
        const target = manifest.exports[entry].require
        return { entry, target, exists: typeof target === 'string' && existsSync(installedPath(target)) }
      })
      expect(resolved).toEqual(entries.map((entry) => ({ entry, target: expect.stringMatching(/index\.cjs$/), exists: true })))
    })

    it('requires every export entry', () => {
      expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
    })
  })

  describe('main entry', () => {
    it('exports the Jest-style surface', () => {
      const names = consumer.run(() => Object.keys(require('@hyperfrontend/testing')).sort(), { kind: 'require' })
      expect(names).toEqual(MAIN_EXPORTS)
    })

    it('pulls in neither preload, so no document appears on the global', () => {
      const documentType = consumer.run(
        () => {
          require('@hyperfrontend/testing')
          return typeof document
        },
        { kind: 'require' }
      )
      expect(documentType).toBe('undefined')
    })

    it('carries the it modifiers, the expect statics and the jest namespace', () => {
      const kinds = consumer.run(
        () => {
          const { expect: packedExpect, it: packedIt, jest: packedJest } = require('@hyperfrontend/testing')
          const typesOf = (target, names) => names.map((name) => typeof target[name])
          return {
            it: typesOf(packedIt, ['each', 'only', 'skip', 'todo', 'concurrent', 'failing']),
            expect: typesOf(packedExpect, [
              'any',
              'anything',
              'objectContaining',
              'arrayContaining',
              'stringContaining',
              'stringMatching',
              'closeTo',
              'assertions',
              'hasAssertions',
            ]),
            jest: typesOf(packedJest, Object.keys(packedJest)),
          }
        },
        { kind: 'require' }
      )
      const functions = (count) => Array.from({ length: count }, () => 'function')
      expect(kinds).toEqual({
        it: functions(IT_MODIFIERS.length),
        expect: functions(EXPECT_STATICS.length),
        jest: functions(JEST_METHODS.length),
      })
    })
  })

  describe('fs and process entries', () => {
    it('writes a tree into a temporary directory and removes it', () => {
      const facts = consumer.run(
        () => {
          const { createTempDir } = require('@hyperfrontend/testing/fs')
          const { existsSync: exists } = require('node:fs')
          const dir = createTempDir({ tree: { 'a.txt': 'a' } })
          const text = dir.read('a.txt')
          dir.remove()
          return { text, removed: !exists(dir.path) }
        },
        { kind: 'require' }
      )
      expect(facts).toEqual({ text: 'a', removed: true })
    })

    it('builds a spawnSync result', () => {
      const result = consumer.run(() => require('@hyperfrontend/testing/process').spawnSyncResult({ stdout: 'ok' }), { kind: 'require' })
      expect(result).toEqual(expect.objectContaining({ status: 0, stdout: 'ok' }))
    })
  })

  describe('installed expect and jest.fn', () => {
    it('matches by identity, by structure with asymmetric matchers, on thrown errors and on settled promises', () => {
      const outcome = consumer.run(
        async () => {
          const { expect: packed } = require('@hyperfrontend/testing')
          packed(2 * 2).toBe(4)
          packed({ id: 7, tags: ['a', 'b'] }).toEqual({ id: packed.any(Number), tags: packed.arrayContaining(['b']) })
          packed(() => {
            throw new RangeError('out of range')
          }).toThrow('out of range')
          await packed(Promise.resolve(3)).resolves.toBe(3)
          await packed(Promise.reject(new Error('nope'))).rejects.toThrow('nope')
          return 'matched'
        },
        { kind: 'require' }
      )
      expect(outcome).toBe('matched')
    })

    it('raises a failed toBe as a thrown assertion naming both values', () => {
      const message = consumer.run(
        () => {
          const { expect: packed } = require('@hyperfrontend/testing')
          try {
            packed(1).toBe(2)
            return 'passed'
          } catch (error) {
            return error.message
          }
        },
        { kind: 'require' }
      )
      expect(message).toMatch(/expected 1 to be 2/)
    })

    it('inspects the calls recorded on a jest.fn', () => {
      const facts = consumer.run(
        () => {
          const { expect: packed, jest: packedJest } = require('@hyperfrontend/testing')
          const record = packedJest.fn()
          record('first', 1)
          record('second', 2)
          packed(record).toHaveBeenCalledTimes(2)
          packed(record).toHaveBeenCalledWith('first', 1)
          packed(record).toHaveBeenLastCalledWith('second', 2)
          try {
            packed(record).toHaveBeenCalledWith('third', 3)
            return 'unexpected call accepted'
          } catch {
            return 'unexpected call refused'
          }
        },
        { kind: 'require' }
      )
      expect(facts).toBe('unexpected call refused')
    })
  })

  describe('installed runner', () => {
    it('exports the runner functions and the baseline coverage exclusions', () => {
      const surface = consumer.run(
        (names) => {
          const runner = require('@hyperfrontend/testing/runner')
          return { functions: names.filter((name) => typeof runner[name] === 'function'), baseline: runner.BASELINE_COVERAGE_EXCLUDE }
        },
        { kind: 'require', args: RUNNER_FUNCTIONS }
      )
      expect(surface).toEqual({ functions: RUNNER_FUNCTIONS, baseline: BASELINE_EXCLUDE })
    })

    it('locates the ES module preloads and reporter from the CommonJS build', () => {
      const argv = consumer.run(
        (args) => {
          const { buildRunPlan, withDefaults } = require('@hyperfrontend/testing/runner')
          const config = withDefaults({
            environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true }],
            coverageInclude: ['src/**/*.ts'],
          })
          return buildRunPlan(config, config.environments[0], args.projectRoot, 'unused').argv
        },
        { kind: 'require', args: { projectRoot: join(consumer.path, consumerProjectPath('project')) } }
      )
      const installedUrl = (...segments) => pathToFileURL(installedPath(...segments)).href
      expect(argv).toEqual(
        expect.arrayContaining([
          installedUrl('hooks', 'index.mjs'),
          installedUrl('dom', 'index.mjs'),
          `--test-reporter=${installedUrl('reporter', 'index.mjs')}`,
        ])
      )
    })

    it('runs a project to a passing verdict through the preloads it located, tabling its source', () => {
      const report = runInstalledRunner({
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/math.ts'],
        coverageThresholds: { lines: 100, branches: 100, functions: 100 },
      })
      expect({
        success: report.success,
        failures: report.failures,
        tabled: report.coverageTable.some((row) => row.startsWith('src/math.ts')),
      }).toEqual({
        success: true,
        failures: [],
        tabled: true,
      })
    })

    it('writes the merged lcov.info naming the file from the workspace root', () => {
      const report = runInstalledRunner({
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/math.ts'],
      })
      // why: lcov names files with forward slashes on every platform, so the expected path is built as a portable one.
      expect(report.lcov).toContain(`SF:${posix.join(consumerProjectPath('project'), 'src', 'math.ts')}\n`)
    })

    it('fails a run whose coverage misses a declared threshold', () => {
      const report = runInstalledRunner({
        environments: [{ name: 'node', testMatch: ['src/extras.spec.ts'] }],
        coverageInclude: ['src/extras.ts'],
        coverageThresholds: { functions: 100 },
      })
      expect({ success: report.success, failures: report.failures }).toEqual({
        success: false,
        failures: ['50.00% function coverage does not meet threshold of 100%'],
      })
    })

    it('preloads a setup module whose jest.mock applies to every spec', () => {
      const report = runInstalledRunner({
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'], setupFiles: ['test.setup.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect({ success: report.success, failures: report.failures }).toEqual({ success: true, failures: [] })
    })
  })

  describe('installed coverage entry', () => {
    it('exports the merge, render, gate and completeness functions', () => {
      const names = consumer.run(() => Object.keys(require('@hyperfrontend/testing/coverage')).sort(), { kind: 'require' })
      expect(names).toEqual([...COVERAGE_EXPORTS].sort())
    })

    it('reads a report, totals the lines of its file, lists the uncovered ranges and reports a missed threshold', () => {
      const facts = consumer.run(
        (args) => {
          const { fileTotals, findThresholdShortfalls, mergeLcov, percentOf, uncoveredRanges } = require('@hyperfrontend/testing/coverage')
          const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
          const { tmpdir } = require('node:os')
          const { join: joinPath } = require('node:path')
          const dir = mkdtempSync(joinPath(tmpdir(), 'hf-testing-e2e-cjs-lcov-'))
          try {
            const report = joinPath(dir, 'lcov.node.info')
            writeFileSync(report, args.lcov)
            const files = [...mergeLcov([report]).values()]
            return {
              lines: fileTotals(files[0]).lines,
              percent: Math.round(percentOf(fileTotals(files[0]).lines) * 100) / 100,
              uncovered: uncoveredRanges(files[0]),
              shortfalls: findThresholdShortfalls(files, { lines: 50 }),
            }
          } finally {
            rmSync(dir, { recursive: true, force: true })
          }
        },
        { kind: 'require', args: { lcov: SAMPLE_LCOV } }
      )
      expect(facts).toEqual({
        lines: { found: 3, hit: 1 },
        percent: 33.33,
        uncovered: ['2-3'],
        shortfalls: ['33.33% line coverage does not meet threshold of 50%'],
      })
    })
  })
})
