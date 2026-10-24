import type { Mock } from '@hyperfrontend/testing'
import type { FakeChildProcess } from '@hyperfrontend/testing/process'
import type { MemoryMonitor, MemorySnapshot } from '../../memory/monitor'
import type { PrePassJob, PrePassResult } from './pre-pass'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio, createFakeChildProcess } from '@hyperfrontend/testing/process'
import { resolveDefaultWorkerPath, runPrePass } from './pre-pass'
jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual<typeof import('@hyperfrontend/logging')>('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return {
    ...actual,
    logger: { channel: jest.fn(() => mockChannel) },
    __mockChannel: mockChannel,
  }
})
jest.mock('node:child_process', () => ({ spawn: jest.fn() }))

interface SpawnRecord {
  execPath: string
  args: string[]
  reportPath: string
  child: FakeChildProcess
}

const captureSpawn = (records: SpawnRecord[]): Mock => {
  return (spawn as Mock).mockImplementation((execPath: string, args: string[]) => {
    const child = createFakeChildProcess()
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
  outputPath: '/abs/dist/libs/builder/_dependencies/rollup/index.mjs',
  otherDeps: ['postject'],
  ...overrides,
})

beforeEach(() => {
  ;(spawn as Mock).mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('runPrePass', () => {
  it('returns an empty list when no jobs are supplied', async () => {
    const results = await runPrePass([], { workerPath: '/abs/worker.cjs' })
    expect(results).toEqual([])
  })

  it('spawns no worker when no jobs are supplied', async () => {
    await runPrePass([], { workerPath: '/abs/worker.cjs' })
    expect(spawn).not.toHaveBeenCalled()
  })

  const driveTwoJobs = async (): Promise<{ spawnCounts: number[]; jobs: PrePassJob[]; results: PrePassResult[] }> => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const jobs = [baseJob({ dep: 'rollup' }), baseJob({ dep: 'postject', otherDeps: ['rollup'] })]
    const promise = runPrePass(jobs, { workerPath: '/abs/worker.cjs' })
    const spawnCounts: number[] = []
    await flushPromises()
    spawnCounts.push(records.length)
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await flushPromises()
    spawnCounts.push(records.length)
    writeReport((records[1] as SpawnRecord).reportPath, { outputSize: 200, endHeapMB: 2.5, endRssMB: 75, durationMs: 30 })
    ;(records[1] as SpawnRecord).child.exit(0)
    const results = await promise
    return { spawnCounts, jobs, results }
  }

  it('forks the workers one at a time, each after the previous one exits', async () => {
    const { spawnCounts } = await driveTwoJobs()
    expect(spawnCounts).toEqual([1, 2])
  })

  it('aggregates the JSON reports in job order', async () => {
    const { jobs, results } = await driveTwoJobs()
    expect(results).toEqual([
      expect.objectContaining({ outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25, job: jobs[0] }),
      expect.objectContaining({ outputSize: 200, endHeapMB: 2.5, endRssMB: 75, durationMs: 30, job: jobs[1] }),
    ])
  })

  it('rejects when a worker exits with a non-zero code and includes the job in the message', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.exit(1)
    await expect(promise).rejects.toThrow(/pre-pass worker for rollup .*exited with code 1/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.fail(new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob({ dep: 'rollup' })], { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.exit(0)
    await expect(promise).rejects.toThrow(/did not write a report/)
  })

  it('passes execPath and execArgv overrides to spawn', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob()], {
      workerPath: '/abs/worker.cjs',
      execPath: '/usr/bin/custom-node',
      execArgv: ['--require', '@swc-node/register'],
    })
    await flushPromises()
    expect({ execPath: (records[0] as SpawnRecord).execPath, leadingArgs: (records[0] as SpawnRecord).args.slice(0, 3) }).toEqual({
      execPath: '/usr/bin/custom-node',
      leadingArgs: ['--require', '@swc-node/register', '/abs/worker.cjs'],
    })
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
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
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs', monitor })
    await flushPromises()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 10, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
    expect(checks).toEqual(['bundle:dependencies:prepass:1/1:rollup:js:esm:start', 'bundle:dependencies:prepass:1/1:rollup:js:esm:end'])
  })

  it('cleans up the temporary report directory even when a job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    const reportDir = dirname((records[0] as SpawnRecord).reportPath)
    ;(records[0] as SpawnRecord).child.exit(2)
    await promise.catch(() => undefined)
    expect(existsSync(reportDir)).toBe(false)
  })

  it('includes the captured stderr tail when a worker exits with a non-zero code', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    captureStdio({ stdout: false })
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.writeStderr('boom oh no\n')
    ;(records[0] as SpawnRecord).child.exit(1)
    await expect(promise).rejects.toThrow(/exited with code 1[\s\S]*boom oh no/)
  })

  it('passes stdout chunks through to the parent stdout', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const stdio = captureStdio({ stderr: false })
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.writeStdout('child output\n')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
    stdio.restore()
    expect(stdio.stdout()).toBe('child output\n')
  })

  it('passes stderr string chunks through to the parent stderr', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const stdio = captureStdio({ stdout: false })
    const promise = runPrePass([baseJob()], { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.stderr.setEncoding('utf8')
    ;(records[0] as SpawnRecord).child.writeStderr('string chunk\n')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
    stdio.restore()
    expect(stdio.stderr()).toBe('string chunk\n')
  })
})

describe('resolveDefaultWorkerPath', () => {
  const dir = useTempDir({ prefix: 'builder-prepass-resolver-' })

  it('resolves the worker at the bundle/dependencies/worker offset beside the builder', () => {
    const path = dir.write('bundle/dependencies/worker/index.cjs', '/* fake worker */')
    expect(resolveDefaultWorkerPath(dir.path)).toEqual({ path, execArgv: [] })
  })

  it('returns undefined when no pre-pass worker exists under any ancestor', () => {
    expect(resolveDefaultWorkerPath(dir.path)).toBeUndefined()
  })
})
