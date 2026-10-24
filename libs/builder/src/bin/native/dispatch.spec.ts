import type { Mock } from '@hyperfrontend/testing'
import type { FakeChildProcess } from '@hyperfrontend/testing/process'
import type { MemoryMonitor, MemorySnapshot } from '../../memory/monitor'
import type { InjectWorkerJob } from './worker/types'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio, createFakeChildProcess } from '@hyperfrontend/testing/process'
import { dispatchInjectWorker, resolveDefaultInjectWorkerPath } from './dispatch'
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
  job: InjectWorkerJob
}

const captureSpawn = (records: SpawnRecord[]): Mock =>
  (spawn as Mock).mockImplementation((execPath: string, args: string[]) => {
    const child = createFakeChildProcess()
    const jobJson = args[args.length - 1] as string
    const job = JSON.parse(jobJson) as InjectWorkerJob
    records.push({ execPath, args, reportPath: job.reportPath, child, job })
    return child as unknown as ReturnType<typeof spawn>
  })

const writeReport = (reportPath: string, payload: object): void => {
  writeFileSync(reportPath, JSON.stringify(payload))
}

const baseJob = (overrides: Partial<InjectWorkerJob> = {}): InjectWorkerJob => ({
  hostBinary: '/opt/node',
  outputBinary: '/abs/dist/libs/builder/bin/hf-build.linux-x64',
  blobPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
  resourceName: 'NODE_SEA_BLOB',
  machoSegmentName: 'NODE_SEA',
  sentinelFuse: 'NODE_SEA_FUSE_xxxxx',
  reportPath: '/abs/will-be-overwritten',
  ...overrides,
})

beforeEach(() => {
  ;(spawn as Mock).mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('dispatchInjectWorker', () => {
  it('forks exactly one worker for the job', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 138_000_000, endHeapMB: 220, endRssMB: 480, durationMs: 1200 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
    expect(records).toHaveLength(1)
  })

  it('resolves with the JSON report the worker wrote', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 138_000_000, endHeapMB: 220, endRssMB: 480, durationMs: 1200 })
    ;(records[0] as SpawnRecord).child.exit(0)
    const result = await promise
    expect(result).toEqual({ outputSize: 138_000_000, endHeapMB: 220, endRssMB: 480, durationMs: 1200 })
  })

  it('overwrites the job reportPath with a temp-dir path before forking', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob({ reportPath: '/abs/orig.json' }), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    expect((records[0] as SpawnRecord).job.reportPath).toContain('hf-builder-inject-')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
  })

  it('rejects when the worker exits with a non-zero code and includes the captured stderr tail', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    captureStdio({ stdout: false })
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.writeStderr('boom oh no\n')
    ;(records[0] as SpawnRecord).child.exit(1)
    await expect(promise).rejects.toThrow(/exited with code 1[\s\S]*boom oh no/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.fail(new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.exit(0)
    await expect(promise).rejects.toThrow(/did not write a report/)
  })

  it('passes execPath and execArgv overrides to spawn', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), {
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

  it('invokes the optional memory monitor before and after the dispatched job using the supplied label', async () => {
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
    const promise = dispatchInjectWorker(baseJob(), {
      workerPath: '/abs/worker.cjs',
      monitor,
      label: 'hf-build',
    })
    await flushPromises()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
    expect(checks).toEqual(['bin:native:dispatch:hf-build:start', 'bin:native:dispatch:hf-build:end'])
  })

  it('falls back to outputBinary as the label when no explicit label is supplied', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.exit(1)
    await expect(promise).rejects.toThrow(/inject worker for \/abs\/dist\/libs\/builder\/bin\/hf-build\.linux-x64/)
  })

  it('cleans up the temporary report directory even when the job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    const reportDir = dirname((records[0] as SpawnRecord).reportPath)
    ;(records[0] as SpawnRecord).child.exit(2)
    await promise.catch(() => undefined)
    expect(existsSync(reportDir)).toBe(false)
  })

  it('passes stdout chunks through to the parent stdout', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const stdio = captureStdio({ stderr: false })
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
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
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs' })
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

describe('resolveDefaultInjectWorkerPath', () => {
  const dir = useTempDir({ prefix: 'builder-inject-resolver-' })

  const writeWorkerAt = (relative: string): string => dir.write(relative, '/* fake worker */')

  it('returns undefined when neither dist, node_modules, nor source has the worker', () => {
    expect(resolveDefaultInjectWorkerPath(dir.path)).toBeUndefined()
  })

  it('returns the dist path when the dist worker exists', () => {
    const path = writeWorkerAt('dist/libs/builder/bin/native/worker/index.cjs')
    expect(resolveDefaultInjectWorkerPath(dir.path)).toEqual({ path, execArgv: [] })
  })

  it('falls back to node_modules when the dist worker is missing', () => {
    const path = writeWorkerAt('node_modules/@hyperfrontend/builder/bin/native/worker/index.cjs')
    expect(resolveDefaultInjectWorkerPath(dir.path)).toEqual({ path, execArgv: [] })
  })

  it('prefers the dist worker when both are present', () => {
    const distPath = writeWorkerAt('dist/libs/builder/bin/native/worker/index.cjs')
    writeWorkerAt('node_modules/@hyperfrontend/builder/bin/native/worker/index.cjs')
    expect(resolveDefaultInjectWorkerPath(dir.path)).toEqual({ path: distPath, execArgv: [] })
  })

  it('falls back to the in-source worker.ts via @swc-node/register when dist+node_modules are missing', () => {
    const sourcePath = writeWorkerAt('libs/builder/src/bin/native/worker/index.ts')
    writeWorkerAt('node_modules/@swc-node/register/index.js')
    expect(resolveDefaultInjectWorkerPath(dir.path)).toEqual({ path: sourcePath, execArgv: ['--require', '@swc-node/register'] })
  })

  it('returns undefined when only the source worker.ts is present but @swc-node/register is missing', () => {
    writeWorkerAt('libs/builder/src/bin/native/worker/index.ts')
    expect(resolveDefaultInjectWorkerPath(dir.path)).toBeUndefined()
  })
})
