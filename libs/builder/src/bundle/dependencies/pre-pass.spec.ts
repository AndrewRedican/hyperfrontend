import type { MemoryMonitor, MemorySnapshot } from '../../memory/monitor'
import type { PrePassJob } from './pre-pass'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveDefaultWorkerPath, runPrePass } from './pre-pass'
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

const tick = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve))

const makeFakeChild = (): EventEmitter => new EventEmitter()

interface SpawnRecord {
  execPath: string
  args: string[]
  reportPath: string
  child: EventEmitter
}

const captureSpawn = (records: SpawnRecord[]): jest.Mock => {
  return (spawn as jest.Mock).mockImplementation((execPath: string, args: string[]) => {
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
  ;(spawn as jest.Mock).mockReset()
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
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await tick()
    expect(records).toHaveLength(2)
    writeReport((records[1] as SpawnRecord).reportPath, { outputSize: 200, endHeapMB: 2.5, endRssMB: 75, durationMs: 30 })
    ;(records[1] as SpawnRecord).child.emit('exit', 0)
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
    ;(records[0] as SpawnRecord).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/pre-pass worker for rollup .*exited with code 1/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('error', new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
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
    expect((records[0] as SpawnRecord).execPath).toBe('/usr/bin/custom-node')
    expect((records[0] as SpawnRecord).args.slice(0, 3)).toEqual(['--require', '@swc-node/register', '/abs/worker.cjs.js'])
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
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
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 10, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await promise
    expect(checks).toEqual(['bundle:dependencies:prepass:1/1:rollup:js:esm:start', 'bundle:dependencies:prepass:1/1:rollup:js:esm:end'])
  })

  it('cleans up the temporary report directory even when a job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs.js' })
    await tick()
    const reportDir = (records[0] as SpawnRecord).reportPath.substring(0, (records[0] as SpawnRecord).reportPath.lastIndexOf('/'))
    ;(records[0] as SpawnRecord).child.emit('exit', 2)
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

  it('resolves the worker at the bundle/dependencies/worker offset beside the builder', () => {
    const targetDir = join(root, 'bundle', 'dependencies', 'worker')
    mkdirSync(targetDir, { recursive: true })
    const path = join(targetDir, 'index.cjs.js')
    writeFileSync(path, '/* fake worker */', { flag: 'w' })
    expect(resolveDefaultWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('returns undefined when no pre-pass worker exists under any ancestor', () => {
    expect(resolveDefaultWorkerPath(root)).toBeUndefined()
  })
})
