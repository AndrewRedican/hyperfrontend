/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/testing`.
 *
 * The packed tarball is installed into a consumer outside the workspace, with jsdom beside it as the optional peer a
 * consumer brings, and every test runs under plain Node with no loader hooks: the package's own preloads, reporter
 * and runner are exercised from a consumer's seat, and every entry carries its documented surface.
 */

import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import type { TestConfig } from '@hyperfrontend/testing/runner'
import type { ChildSuiteOptions } from './support/child-suite'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'
import { childSuiteArgv, tapCount } from './support/child-suite'
import { JEST_STYLE_SPECS, JEST_STYLE_SUITES, consumerProjectPath, consumerProjectsTree } from './support/consumer-projects'
import {
  BASELINE_EXCLUDE,
  COVERAGE_EXPORTS,
  DESCRIBE_MODIFIERS,
  ENTRIES,
  EXPECT_NEGATIONS,
  EXPECT_STATICS,
  HELPER_EXPORTS,
  IT_MODIFIERS,
  JEST_METHODS,
  MAIN_EXPORTS,
  RUNNER_FUNCTIONS,
} from './support/documented-surface'
import { installedPath, installedUrl, runInstalledRunner } from './support/installed-runner'

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

/** A sample lcov report and the project the unmeasured-files check is pointed at. */
interface CoverageArgs {
  /** The lcov text merged twice. */
  lcov: string
  /** The project directory whose sources are checked for measurement. */
  projectRoot: string
}

/** The project a run plan is built for. */
interface PlanArgs {
  /** The project root. */
  projectRoot: string
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL, peers: ['jsdom@26.1.0'] })

before(() => consumer.writeTree(consumerProjectsTree()))

/**
 * Runs spec files of a consumer project on Node's test runner in a child, judged by Node's own reporter.
 *
 * @param project - The consumer project the child runs from.
 * @param preloadUrls - `file:` URLs handed to `--import`, in order.
 * @param specs - Spec files, relative to the project.
 * @param options - The reporter and any further Node arguments.
 * @returns The child's exit status and output.
 */
function runChildSuite(
  project: string,
  preloadUrls: readonly string[],
  specs: readonly string[],
  options: ChildSuiteOptions = {}
): ConsumerRun {
  return consumer.node(childSuiteArgv(preloadUrls, specs, options), { cwd: consumerProjectPath(project) })
}

describe('@hyperfrontend/testing ESM', () => {
  describe('package layout', () => {
    it('maps the ten entries and the manifest in exports', () => {
      const manifest = JSON.parse(readFileSync(installedPath(consumer, 'package.json'), 'utf8')) as { exports: Record<string, unknown> }
      expect(Object.keys(manifest.exports).sort()).toEqual([
        '.',
        './browser',
        './consumer',
        './coverage',
        './dom',
        './fs',
        './hooks',
        './package.json',
        './process',
        './reporter',
        './runner',
      ])
    })

    it('ships an ES module, a CommonJS twin and a declaration for every entry', () => {
      const files = ENTRIES.flatMap((entry) => ['index.mjs', 'index.cjs', 'index.d.ts'].map((file) => join(entry, file)))
      expect(files.filter((file) => !existsSync(installedPath(consumer, file)))).toEqual([])
    })

    it('declares no runtime dependencies, names jsdom as an optional peer and requires Node 22.18 or later', () => {
      const manifest = JSON.parse(readFileSync(installedPath(consumer, 'package.json'), 'utf8')) as Record<string, unknown>
      expect({
        dependencies: manifest.dependencies,
        peers: manifest.peerDependencies,
        meta: manifest.peerDependenciesMeta,
        engines: manifest.engines,
      }).toEqual({
        dependencies: undefined,
        peers: { jsdom: '>=26.0.0' },
        meta: { jsdom: { optional: true } },
        engines: { node: '>=22.18.0', npm: '>=8.0.0' },
      })
    })

    it('installs without a node_modules directory of its own', () => {
      expect(existsSync(installedPath(consumer, 'node_modules'))).toBe(false)
    })

    it('imports every export entry', () => {
      expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
    })
  })

  describe('main entry', () => {
    it('exports the Jest-style surface', () => {
      const names = consumer.run(async () => Object.keys(await import('@hyperfrontend/testing')).sort())
      expect(names).toEqual(MAIN_EXPORTS)
    })

    it('pulls in neither preload, so no document appears on the global', () => {
      const documentType = consumer.run(async () => {
        await import('@hyperfrontend/testing')
        return typeof document
      })
      expect(documentType).toBe('undefined')
    })

    it('carries the it and describe modifiers, the expect statics with their negations and the jest namespace', () => {
      const kinds = consumer.run(async () => {
        const { describe: packedDescribe, expect: packedExpect, it: packedIt, jest: packedJest } = await import('@hyperfrontend/testing')
        const typesOf = (target: object, names: readonly string[]) => names.map((name) => typeof (target as Record<string, unknown>)[name])
        return {
          it: typesOf(packedIt, ['each', 'only', 'skip', 'todo', 'concurrent', 'failing']),
          describe: typesOf(packedDescribe, ['each', 'only', 'skip']),
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
          negations: typesOf(packedExpect.not, ['objectContaining', 'arrayContaining', 'stringContaining', 'stringMatching']),
          jest: typesOf(packedJest, Object.keys(packedJest)),
        }
      })
      const functions = (count: number) => Array.from({ length: count }, () => 'function')
      expect(kinds).toEqual({
        it: functions(IT_MODIFIERS.length),
        describe: functions(DESCRIBE_MODIFIERS.length),
        expect: functions(EXPECT_STATICS.length),
        negations: functions(EXPECT_NEGATIONS.length),
        jest: functions(JEST_METHODS.length),
      })
    })

    it('exports equals and matchesSubset helpers that accept and reject as documented', () => {
      const verdicts = consumer.run(async () => {
        const { equals, matchesSubset } = await import('@hyperfrontend/testing')
        return [
          equals({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }),
          equals({ a: 1 }, { a: 2 }),
          matchesSubset({ a: 1, b: 2 }, { a: 1 }),
          matchesSubset({ a: 1 }, { a: 1, b: 2 }),
        ]
      })
      expect(verdicts).toEqual([true, false, true, false])
    })
  })

  describe('installed expect and jest', () => {
    it('matches by identity, by structure with asymmetric matchers, on thrown errors and on settled promises', () => {
      const outcome = consumer.run(async () => {
        const { expect: packed } = await import('@hyperfrontend/testing')
        packed(1 + 1).toBe(2)
        packed({ id: 7, tags: ['a', 'b'], name: 'x' }).toEqual({
          id: packed.any(Number),
          tags: packed.arrayContaining(['b']),
          name: packed.stringMatching(/^x$/),
        })
        packed({ nested: { kept: true, extra: 1 } }).toEqual({ nested: packed.objectContaining({ kept: true }) })
        packed(0.1 + 0.2).toEqual(packed.closeTo(0.3, 5))
        packed('abc').toEqual(packed.not.stringContaining('z'))
        packed(() => {
          throw new TypeError('boom')
        }).toThrow(TypeError)
        packed(() => undefined).not.toThrow()
        await packed(Promise.resolve({ ok: true })).resolves.toEqual({ ok: true })
        await packed(Promise.reject(new Error('nope'))).rejects.toThrow('nope')
        return 'matched'
      })
      expect(outcome).toBe('matched')
    })

    it('raises a failed matcher as a thrown assertion naming both values', () => {
      const messages = consumer.run(async () => {
        const { expect: packed } = await import('@hyperfrontend/testing')
        const thrown = (attempt: () => void) => {
          try {
            attempt()
            return 'passed'
          } catch (error) {
            return (error as Error).message
          }
        }
        return [thrown(() => packed(1).toBe(2)), thrown(() => packed({ a: 1 }).toEqual({ a: packed.any(String) })) === 'passed']
      })
      expect(messages).toEqual([expect.stringMatching(/expected 1 to be 2/), false])
    })

    it('records the calls of a jest.fn, spies on a method and restores it', () => {
      const facts = consumer.run(async () => {
        const { expect: packed, jest: packedJest } = await import('@hyperfrontend/testing')
        const add = packedJest.fn((left: number, right: number) => left + right)
        add(1, 2)
        add(3, 4)
        packed(add).toHaveBeenCalledTimes(2)
        packed(add).toHaveBeenCalledWith(1, 2)
        packed(add).toHaveBeenLastCalledWith(3, 4)
        let unexpectedCallRefused = false
        try {
          packed(add).toHaveBeenCalledWith(9, 9)
        } catch {
          unexpectedCallRefused = true
        }
        const target = { greet: (name: string) => `hello ${name}` }
        const original = target.greet
        const spy = packedJest.spyOn(target, 'greet')
        const greeting = target.greet('ada')
        packed(spy).toHaveBeenCalledWith('ada')
        spy.mockRestore()
        return {
          results: add.mock.results.map((result) => result.value),
          unexpectedCallRefused,
          greeting,
          restored: target.greet === original,
        }
      })
      expect(facts).toEqual({ results: [3, 7], unexpectedCallRefused: true, greeting: 'hello ada', restored: true })
    })
  })

  describe('installed hooks preload', () => {
    let suite: ConsumerRun
    let failed: ConsumerRun

    before(() => {
      suite = runChildSuite('jest-style', [installedUrl(consumer, 'hooks', 'index.mjs')], JEST_STYLE_SPECS)
      failed = runChildSuite('failing', [installedUrl(consumer, 'hooks', 'index.mjs')], ['src/failing.spec.ts'])
    })

    it('exits 0 with nothing on stderr after a Jest-style suite: module mocks, fake timers, it.each and assertion counts', () => {
      expect({ status: suite.status, stderr: suite.stderr }).toEqual({ status: 0, stderr: '' })
    })

    it('passes all 14 tests of the Jest-style suite', () => {
      expect({
        tests: tapCount(suite.stdout, 'tests'),
        pass: tapCount(suite.stdout, 'pass'),
        fail: tapCount(suite.stdout, 'fail'),
      }).toEqual({
        tests: 14,
        pass: 14,
        fail: 0,
      })
    })

    it('reports every fixture suite as passed under its own name', () => {
      expect(JEST_STYLE_SUITES.filter((name) => !suite.stdout.includes(`- ${name}\n`))).toEqual([])
    })

    it('renders it.each titles with %s and %p', () => {
      const titles = ['# Subtest: adds 1 and 2 to make 3', '# Subtest: adds 2 and 3 to make 5', "# Subtest: joins ab and cd into 'abcd'"]
      expect(titles.filter((title) => !suite.stdout.includes(title))).toEqual([])
    })

    it('exits non-zero and counts the failures of a suite that fails, so a clean exit is not vacuous', () => {
      expect({
        status: failed.status,
        tests: tapCount(failed.stdout, 'tests'),
        pass: tapCount(failed.stdout, 'pass'),
        fail: tapCount(failed.stdout, 'fail'),
      }).toEqual({ status: 1, tests: 3, pass: 1, fail: 2 })
    })

    it('reports the failing suite as not ok', () => {
      expect(failed.stdout).toContain('not ok 1 - a suite that fails on purpose')
    })
  })

  describe('installed dom preload', () => {
    let domRun: ConsumerRun

    before(() => {
      domRun = runChildSuite(
        'dom',
        [installedUrl(consumer, 'hooks', 'index.mjs'), installedUrl(consumer, 'dom', 'index.mjs')],
        ['src/dom.spec.ts']
      )
    })

    it('gives a suite a document and makes window the global object, exiting 0 with nothing on stderr', () => {
      expect({
        status: domRun.status,
        stderr: domRun.stderr,
        pass: tapCount(domRun.stdout, 'pass'),
        fail: tapCount(domRun.stdout, 'fail'),
      }).toEqual({
        status: 0,
        stderr: '',
        pass: 3,
        fail: 0,
      })
    })

    it('takes jsdom from the consumer, which installs the optional peer itself', () => {
      expect(existsSync(join(consumer.path, 'node_modules', 'jsdom', 'package.json'))).toBe(true)
    })
  })

  describe('installed reporter', () => {
    let reported: ConsumerRun
    let printed: ConsumerRun

    before(() => {
      reported = runChildSuite('project', [installedUrl(consumer, 'hooks', 'index.mjs')], ['src/math.spec.ts'], {
        reporter: installedUrl(consumer, 'reporter', 'index.mjs'),
        nodeArgs: COVERAGE_FLAGS,
      })
      printed = runChildSuite('project', [installedUrl(consumer, 'hooks', 'index.mjs')], ['src/math.spec.ts'], {
        reporter: 'spec',
        nodeArgs: COVERAGE_FLAGS,
      })
    })

    it('exits 0, prints the pass line and withholds the coverage block', () => {
      expect({
        status: reported.status,
        passLine: /\bpass 2\b/.test(reported.stdout),
        coverageBlock: /coverage report/.test(reported.stdout),
      }).toEqual({
        status: 0,
        passLine: true,
        coverageBlock: false,
      })
    })

    it('withholds a block that Node prints for the very same run under the spec reporter', () => {
      expect({
        status: printed.status,
        coverageBlock: /start of coverage report[\s\S]*end of coverage report/.test(printed.stdout),
      }).toEqual({
        status: 0,
        coverageBlock: true,
      })
    })
  })

  describe('installed runner', () => {
    /**
     * A configuration whose one spec passes and covers its source completely.
     *
     * @returns The configuration.
     */
    function passingMathConfig(): TestConfig {
      return {
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/math.ts'],
        coverageThresholds: { lines: 100, branches: 100, functions: 100 },
      }
    }

    it('exports the runner functions and the baseline coverage exclusions', () => {
      const surface = consumer.run(
        async (names: readonly string[]) => {
          const runner = await import('@hyperfrontend/testing/runner')
          return {
            functions: names.filter((name) => typeof (runner as Record<string, unknown>)[name] === 'function'),
            baseline: runner.BASELINE_COVERAGE_EXCLUDE,
          }
        },
        { args: RUNNER_FUNCTIONS }
      )
      expect(surface).toEqual({ functions: RUNNER_FUNCTIONS, baseline: BASELINE_EXCLUDE })
    })

    it('fills in the default timeout and the baseline exclusions ahead of the configured ones', () => {
      const resolved = consumer.run(async () => {
        const { withDefaults } = await import('@hyperfrontend/testing/runner')
        const config = withDefaults({ environments: [], coverageInclude: ['src/**/*.ts'], coverageExclude: ['src/generated/**'] })
        return { testTimeout: config.testTimeout, coverageExclude: config.coverageExclude }
      })
      expect(resolved).toEqual({ testTimeout: 30_000, coverageExclude: [...BASELINE_EXCLUDE, 'src/generated/**'] })
    })

    it('plans a run around its own installed preloads and reporter', () => {
      const argv = consumer.run(
        async (args: PlanArgs) => {
          const { buildRunPlan, withDefaults } = await import('@hyperfrontend/testing/runner')
          const config = withDefaults({
            environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true }],
            coverageInclude: ['src/**/*.ts'],
          })
          const [environment] = config.environments
          return environment ? buildRunPlan(config, environment, args.projectRoot, 'unused').argv : []
        },
        { args: { projectRoot: join(consumer.path, consumerProjectPath('project')) } }
      )
      expect(argv).toEqual(
        expect.arrayContaining([
          installedUrl(consumer, 'hooks', 'index.mjs'),
          installedUrl(consumer, 'dom', 'index.mjs'),
          `--test-reporter=${installedUrl(consumer, 'reporter', 'index.mjs')}`,
          '--experimental-test-coverage',
        ])
      )
    })

    it('passes a project whose tests pass and whose thresholds are met, tabling its source at full coverage', () => {
      const report = runInstalledRunner(consumer, passingMathConfig())
      expect({
        success: report.success,
        failures: report.failures,
        tabled: report.coverageTable.some((row) => row.startsWith('src/math.ts') && row.includes('100.00')),
      }).toEqual({ success: true, failures: [], tabled: true })
    })

    it('writes the merged lcov.info naming the file from the workspace root, beside the per-environment report', () => {
      const report = runInstalledRunner(consumer, {
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/math.ts'],
      })
      // why: lcov names files with forward slashes on every platform, so the expected path is built as a portable one.
      const mathSource = posix.join(consumerProjectPath('project'), 'src', 'math.ts')
      expect({ files: report.coverageFiles, names: report.lcov.includes(`SF:${mathSource}\n`) }).toEqual({
        files: ['lcov.info', 'lcov.node.info'],
        names: true,
      })
    })

    it('fails a run that never loaded a file it was asked to measure', () => {
      const report = runInstalledRunner(consumer, {
        environments: [{ name: 'node', testMatch: ['src/math.spec.ts'] }],
        coverageInclude: ['src/**/*.ts'],
      })
      expect({ success: report.success, failureText: report.failures.join('\n') }).toEqual({
        success: false,
        failureText: expect.stringMatching(/no test loaded these files[\s\S]*src\/orphan\.ts/),
      })
    })

    it('fails a run whose coverage misses a declared threshold', () => {
      const report = runInstalledRunner(consumer, {
        environments: [{ name: 'node', testMatch: ['src/extras.spec.ts'] }],
        coverageInclude: ['src/extras.ts'],
        coverageThresholds: { functions: 100 },
      })
      expect({ success: report.success, failures: report.failures }).toEqual({
        success: false,
        failures: ['50.00% function coverage does not meet threshold of 100%'],
      })
    })

    it('fails a run whose suite fails, naming the environment', () => {
      const report = runInstalledRunner(consumer, {
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect({ success: report.success, failures: report.failures }).toEqual({
        success: false,
        failures: ['environment "node" reported failures'],
      })
    })

    it('preloads a setup module whose jest.mock applies to every spec', () => {
      const report = runInstalledRunner(consumer, {
        environments: [{ name: 'node', testMatch: ['src/greeting.spec.ts'], setupFiles: ['test.setup.ts'] }],
        coverageInclude: ['src/greeting.ts'],
      })
      expect({ success: report.success, failures: report.failures }).toEqual({ success: true, failures: [] })
    })

    it('redirects a specifier through moduleNameMapper and measures the stub it loaded', () => {
      const report = runInstalledRunner(consumer, {
        environments: [{ name: 'node', testMatch: ['src/real.spec.ts'] }],
        coverageInclude: ['src/stub.ts'],
        moduleNameMapper: { '^\\./real$': '<rootDir>/src/stub.ts' },
      })
      expect({
        success: report.success,
        failures: report.failures,
        tabled: report.coverageTable.some((row) => row.startsWith('src/stub.ts')),
      }).toEqual({
        success: true,
        failures: [],
        tabled: true,
      })
    })
  })

  describe('installed helper entries', () => {
    it('export the documented surfaces', () => {
      const surfaces = consumer.run(async () => ({
        browser: Object.keys(await import('@hyperfrontend/testing/browser')).sort(),
        fs: Object.keys(await import('@hyperfrontend/testing/fs')).sort(),
        process: Object.keys(await import('@hyperfrontend/testing/process')).sort(),
      }))
      expect(surfaces).toEqual(HELPER_EXPORTS)
    })

    it('delivers a post between a linked pair of windows', () => {
      const received = consumer.run(async () => {
        const { createWindowPair } = await import('@hyperfrontend/testing/browser')
        const [host, frame] = createWindowPair({ delivery: 'sync' })
        const messages: unknown[] = []
        frame.addEventListener('message', (event: MessageEvent) => messages.push({ data: event.data, fromHost: event.source === host }))
        frame.postMessage('PING', '*')
        return messages
      })
      expect(received).toEqual([{ data: 'PING', fromHost: true }])
    })

    it('writes a tree into a temporary directory and removes it', () => {
      const facts = consumer.run(async () => {
        const { createTempDir } = await import('@hyperfrontend/testing/fs')
        const { existsSync: exists } = await import('node:fs')
        const dir = createTempDir({ tree: { 'package.json': { name: 'app' } } })
        const manifest = dir.readJson('package.json')
        dir.remove()
        return { manifest, removed: !exists(dir.path) }
      })
      expect(facts).toEqual({ manifest: { name: 'app' }, removed: true })
    })

    it('types keys into a terminal input one chunk at a time', () => {
      const chunks = consumer.run(async () => {
        const { Keys, createTtyInput } = await import('@hyperfrontend/testing/process')
        const input = createTtyInput()
        const typed: string[] = []
        input.on('data', (chunk: Buffer) => typed.push(chunk.toString()))
        await input.sendKeys('y', Keys.Enter)
        return typed
      })
      expect(chunks).toEqual(['y', '\r'])
    })
  })

  describe('installed coverage entry', () => {
    it('exports the merge, render, gate and completeness functions', () => {
      const names = consumer.run(async () => Object.keys(await import('@hyperfrontend/testing/coverage')).sort())
      expect(names).toEqual([...COVERAGE_EXPORTS].sort())
    })

    it('merges the records of one file, totals them, gates them, lists the uncovered ranges and renders them back', () => {
      const facts = consumer.run(
        async (args: CoverageArgs) => {
          const coverage = await import('@hyperfrontend/testing/coverage')
          const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
          const { tmpdir } = await import('node:os')
          const { join: joinPath } = await import('node:path')
          const dir = mkdtempSync(joinPath(tmpdir(), 'hf-testing-e2e-lcov-'))
          try {
            const report = joinPath(dir, 'lcov.node.info')
            writeFileSync(report, args.lcov)
            const files = [...coverage.mergeLcov([report, report]).values()]
            const [first] = files
            const table = coverage.renderCoverageTable(files)
            const unmeasured = coverage.findUnmeasuredFiles([], args.projectRoot, ['src/**/*.ts'], ['**/*.spec.ts'])
            return {
              paths: files.map((file) => file.path),
              totals: first ? coverage.fileTotals(first) : null,
              percent: Math.round(coverage.percentOf(coverage.overallTotals(files).lines) * 100) / 100,
              uncovered: first ? coverage.uncoveredRanges(first) : null,
              shortfalls: coverage.findThresholdShortfalls(files, { lines: 100, functions: 100 }),
              summed: coverage.renderLcov(files).includes('DA:1,2\n'),
              tabled: table.some((row) => row.startsWith('src/sample.ts')),
              allFilesRow: /^all files/.test(table[table.length - 2] ?? ''),
              unmeasured: {
                covered: unmeasured.covered,
                orphan: unmeasured.missing.includes('src/orphan.ts'),
                specs: unmeasured.missing.filter((file) => file.endsWith('.spec.ts')),
              },
            }
          } finally {
            rmSync(dir, { recursive: true, force: true })
          }
        },
        { args: { lcov: SAMPLE_LCOV, projectRoot: join(consumer.path, consumerProjectPath('project')) } }
      )
      expect(facts).toEqual({
        paths: ['src/sample.ts'],
        totals: { lines: { found: 3, hit: 2 }, branches: { found: 2, hit: 1 }, functions: { found: 1, hit: 1 } },
        percent: 66.67,
        uncovered: ['3'],
        shortfalls: ['66.67% line coverage does not meet threshold of 100%'],
        summed: true,
        tabled: true,
        allFilesRow: true,
        unmeasured: { covered: 0, orphan: true, specs: [] },
      })
    })
  })
})
