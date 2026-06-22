jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return {
    ...actual,
    logger: { channel: jest.fn(() => mockChannel) },
    __mockChannel: mockChannel,
  }
})

jest.mock('node:child_process', () => ({ spawn: jest.fn() }))

import type { MemoryMonitor, MemorySnapshot } from '../../memory/monitor'
import type { PrePassJob } from './pre-pass'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveDefaultWorkerPath, runPrePass } from './pre-pass'

const tick = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve))

const makeFakeChild = (): EventEmitter => new EventEmitter()

interface SpawnRecord {
  execPath: string
  args: string[]
  reportPath: string
  child: EventEmitter
}

const captureSpawn = (records: SpawnRecord[]): jest.Mock => {
  return (<jest.Mock>spawn).mockImplementation((execPath: string, args: string[]) => {
    const child = makeFakeChild()
    const jobJson = args[args.length - 1] as string
    const job = JSON.parse(jobJson) as { reportPath: string }
    records.push({ execPath, args, reportPath: job.reportPath, child })
    return child as unknown as ReturnType<typeof spawn>
  })
}

const writeReport = (reportPath: string, payload: object): void => {
  writeFileSync(reportPath, JSON.stringify(payload))
}

const baseJob = (overrides: Partial<PrePassJob> = {}): PrePassJob => ({
  kind: 'js',
  dep: 'rollup',
  inputPath: '/abs/in.mjs',
  format: 'esm',
  outputPath: '/abs/dist/libs/builder/_dependencies/rollup/index.esm.js',
  otherDeps: ['postject'],
  ...overrides,
})

beforeEach(() => {
  ;(<jest.Mock>spawn).mockReset()
})

describe('runPrePass', () => {
  it('returns an empty list when no jobs are supplied', async () => {
    const results = await runPrePass([], { workerPath: '/abs/worker.cjs.js' })
    expect(results).toEqual([])
    expect(spawn).not.toHaveBeenCalled()
  })

  it('forks one worker per job sequentially and aggregates the JSON reports', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const jobs = [baseJob({ dep: 'rollup' }), baseJob({ dep: 'postject', otherDeps: ['rollup'] })]
    const promise = runPrePass(jobs, { workerPath: '/abs/worker.cjs.js' })
    await tick()
    expect(records).toHaveLength(1)
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await tick()
    expect(records).toHaveLength(2)
    writeReport((<SpawnRecord>records[1]).reportPath, { outputSize: 200, endHeapMB: 2.5, endRssMB: 75, durationMs: 30 })
    ;(<SpawnRecord>records[1]).child.emit('exit', 0)
    const results = await promise
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25, job: jobs[0] })
    expect(results[1]).toMatchObject({ outputSize: 200, endHeapMB: 2.5, endRssMB: 75, durationMs: 30, job: jobs[1] })
  })

  it('rejects when a worker exits with a non-zero code and includes the job in the message', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/pre-pass worker for rollup .*exited with code 1/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.emit('error', new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await expect(promise).rejects.toThrow(/did not write a report/)
  })

  it('passes execPath and execArgv overrides to spawn', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob()], {
      workerPath: '/abs/worker.cjs.js',
      execPath: '/usr/bin/custom-node',
      execArgv: ['--require', '@swc-node/register'],
    })
    await tick()
    expect((<SpawnRecord>records[0]).execPath).toBe('/usr/bin/custom-node')
    expect((<SpawnRecord>records[0]).args.slice(0, 3)).toEqual(['--require', '@swc-node/register', '/abs/worker.cjs.js'])
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await promise
  })

  it('invokes the optional memory monitor before and after each job', async () => {
    const checks: string[] = []
    const monitor: MemoryMonitor = {
      snapshot: () => ({ label: '', timestampMs: 0, heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, externalMB: 0 }),
      check: (label: string): MemorySnapshot => {
        checks.push(label)
        return { label, timestampMs: 0, heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, externalMB: 0 }
      },
      logDebug: () => ({ label: '', timestampMs: 0, heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, externalMB: 0 }),
      logSummary: jest.fn(),
      getSnapshots: () => [],
    }
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs.js', monitor })
    await tick()
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 10, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await promise
    expect(checks).toEqual(['bundle:dependencies:prepass:1/1:rollup:js:esm:start', 'bundle:dependencies:prepass:1/1:rollup:js:esm:end'])
  })

  it('cleans up the temporary report directory even when a job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs.js' })
    await tick()
    const reportDir = (<SpawnRecord>records[0]).reportPath.substring(0, (<SpawnRecord>records[0]).reportPath.lastIndexOf('/'))
    ;(<SpawnRecord>records[0]).child.emit('exit', 2)
    await expect(promise).rejects.toThrow()
    expect(existsSync(reportDir)).toBe(false)
  })
})

describe('resolveDefaultWorkerPath', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-prepass-resolver-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const writeWorkerAt = (relative: string): string => {
    const path = join(root, relative)
    writeFileSync(path, '/* fake worker */', { flag: 'w' })
    return path
  }

  it('returns undefined when neither dist, node_modules, nor source has the worker', () => {
    expect(resolveDefaultWorkerPath(root)).toBeUndefined()
  })

  it('returns the dist path when the dist worker exists', () => {
    const targetDir = join(root, 'dist', 'libs', 'builder', 'bundle', 'dependencies', 'worker')
    require('node:fs').mkdirSync(targetDir, { recursive: true })
    const path = writeWorkerAt('dist/libs/builder/bundle/dependencies/worker/index.cjs.js')
    expect(resolveDefaultWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('falls back to node_modules when the dist worker is missing', () => {
    const targetDir = join(root, 'node_modules', '@hyperfrontend', 'builder', 'bundle', 'dependencies', 'worker')
    require('node:fs').mkdirSync(targetDir, { recursive: true })
    const path = writeWorkerAt('node_modules/@hyperfrontend/builder/bundle/dependencies/worker/index.cjs.js')
    expect(resolveDefaultWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('prefers the dist worker when both are present', () => {
    const distDir = join(root, 'dist', 'libs', 'builder', 'bundle', 'dependencies', 'worker')
    const nmDir = join(root, 'node_modules', '@hyperfrontend', 'builder', 'bundle', 'dependencies', 'worker')
    require('node:fs').mkdirSync(distDir, { recursive: true })
    require('node:fs').mkdirSync(nmDir, { recursive: true })
    const distPath = writeWorkerAt('dist/libs/builder/bundle/dependencies/worker/index.cjs.js')
    writeWorkerAt('node_modules/@hyperfrontend/builder/bundle/dependencies/worker/index.cjs.js')
    expect(resolveDefaultWorkerPath(root)).toEqual({ path: distPath, execArgv: [] })
  })

  it('falls back to the in-source worker.ts via @swc-node/register when dist+node_modules are both missing', () => {
    const sourceDir = join(root, 'libs', 'builder', 'src', 'bundle', 'dependencies', 'worker')
    const swcDir = join(root, 'node_modules', '@swc-node', 'register')
    require('node:fs').mkdirSync(sourceDir, { recursive: true })
    require('node:fs').mkdirSync(swcDir, { recursive: true })
    const sourcePath = writeWorkerAt('libs/builder/src/bundle/dependencies/worker/index.ts')
    writeWorkerAt('node_modules/@swc-node/register/index.js')
    expect(resolveDefaultWorkerPath(root)).toEqual({ path: sourcePath, execArgv: ['--require', '@swc-node/register'] })
  })

  it('returns undefined when only the source worker.ts is present but @swc-node/register is missing', () => {
    const sourceDir = join(root, 'libs', 'builder', 'src', 'bundle', 'dependencies', 'worker')
    require('node:fs').mkdirSync(sourceDir, { recursive: true })
    writeWorkerAt('libs/builder/src/bundle/dependencies/worker/index.ts')
    expect(resolveDefaultWorkerPath(root)).toBeUndefined()
  })
})
