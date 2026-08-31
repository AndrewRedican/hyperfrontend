import type { Mock } from '@hyperfrontend/testing'
import type { MemoryMonitor, MemorySnapshot } from '../../memory/monitor'
import type { InjectWorkerJob } from './worker/types'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { dispatchInjectWorker, resolveDefaultInjectWorkerPath } from './dispatch'
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

interface SpawnRecord {
  execPath: string
  args: string[]
  reportPath: string
  child: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }
  job: InjectWorkerJob
}

const makeFakeChild = (): SpawnRecord['child'] => {
  const child = new EventEmitter() as SpawnRecord['child']
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  return child
}

const captureSpawn = (records: SpawnRecord[]): Mock =>
  (spawn as Mock).mockImplementation((execPath: string, args: string[]) => {
    const child = makeFakeChild()
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

describe('dispatchInjectWorker', () => {
  it('forks the worker, reads the JSON report, and resolves with the parsed value', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    expect(records).toHaveLength(1)
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 138_000_000, endHeapMB: 220, endRssMB: 480, durationMs: 1200 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    const result = await promise
    expect(result).toEqual({ outputSize: 138_000_000, endHeapMB: 220, endRssMB: 480, durationMs: 1200 })
  })

  it('overwrites the job reportPath with a temp-dir path before forking', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob({ reportPath: '/abs/orig.json' }), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    expect((records[0] as SpawnRecord).job.reportPath).not.toBe('/abs/orig.json')
    expect((records[0] as SpawnRecord).job.reportPath).toContain('hf-builder-inject-')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await promise
  })

  it('rejects when the worker exits with a non-zero code and includes the captured stderr tail', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.stderr.emit('data', Buffer.from('boom oh no\n'))
    ;(records[0] as SpawnRecord).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/exited with code 1[\s\S]*boom oh no/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('error', new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await expect(promise).rejects.toThrow(/did not write a report/)
  })

  it('passes execPath and execArgv overrides to spawn', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), {
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
      workerPath: '/abs/worker.cjs.js',
      monitor,
      label: 'hf-build',
    })
    await tick()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await promise
    expect(checks).toEqual(['bin:native:dispatch:hf-build:start', 'bin:native:dispatch:hf-build:end'])
  })

  it('falls back to outputBinary as the label when no explicit label is supplied', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/inject worker for \/abs\/dist\/libs\/builder\/bin\/hf-build\.linux-x64/)
  })

  it('cleans up the temporary report directory even when the job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    const reportDir = (records[0] as SpawnRecord).reportPath.substring(0, (records[0] as SpawnRecord).reportPath.lastIndexOf('/'))
    ;(records[0] as SpawnRecord).child.emit('exit', 2)
    await expect(promise).rejects.toThrow()
    expect(existsSync(reportDir)).toBe(false)
  })

  it('passes stdout chunks through to the parent stdout', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.stdout.emit('data', Buffer.from('child output\n'))
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await promise
    expect(writeSpy).toHaveBeenCalledWith(expect.anything())
    writeSpy.mockRestore()
  })

  it('passes stderr string chunks through to the parent stderr', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const promise = dispatchInjectWorker(baseJob(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.stderr.emit('data', 'string chunk\n')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await promise
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('string chunk'))
    writeSpy.mockRestore()
  })
})

describe('resolveDefaultInjectWorkerPath', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-inject-resolver-'))
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
    expect(resolveDefaultInjectWorkerPath(root)).toBeUndefined()
  })

  it('returns the dist path when the dist worker exists', () => {
    const targetDir = join(root, 'dist', 'libs', 'builder', 'bin', 'native', 'worker')
    mkdirSync(targetDir, { recursive: true })
    const path = writeWorkerAt('dist/libs/builder/bin/native/worker/index.cjs.js')
    expect(resolveDefaultInjectWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('falls back to node_modules when the dist worker is missing', () => {
    const targetDir = join(root, 'node_modules', '@hyperfrontend', 'builder', 'bin', 'native', 'worker')
    mkdirSync(targetDir, { recursive: true })
    const path = writeWorkerAt('node_modules/@hyperfrontend/builder/bin/native/worker/index.cjs.js')
    expect(resolveDefaultInjectWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('prefers the dist worker when both are present', () => {
    const distDir = join(root, 'dist', 'libs', 'builder', 'bin', 'native', 'worker')
    const nmDir = join(root, 'node_modules', '@hyperfrontend', 'builder', 'bin', 'native', 'worker')
    mkdirSync(distDir, { recursive: true })
    mkdirSync(nmDir, { recursive: true })
    const distPath = writeWorkerAt('dist/libs/builder/bin/native/worker/index.cjs.js')
    writeWorkerAt('node_modules/@hyperfrontend/builder/bin/native/worker/index.cjs.js')
    expect(resolveDefaultInjectWorkerPath(root)).toEqual({ path: distPath, execArgv: [] })
  })

  it('falls back to the in-source worker.ts via @swc-node/register when dist+node_modules are missing', () => {
    const sourceDir = join(root, 'libs', 'builder', 'src', 'bin', 'native', 'worker')
    const swcDir = join(root, 'node_modules', '@swc-node', 'register')
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(swcDir, { recursive: true })
    const sourcePath = writeWorkerAt('libs/builder/src/bin/native/worker/index.ts')
    writeWorkerAt('node_modules/@swc-node/register/index.js')
    expect(resolveDefaultInjectWorkerPath(root)).toEqual({ path: sourcePath, execArgv: ['--require', '@swc-node/register'] })
  })

  it('returns undefined when only the source worker.ts is present but @swc-node/register is missing', () => {
    const sourceDir = join(root, 'libs', 'builder', 'src', 'bin', 'native', 'worker')
    mkdirSync(sourceDir, { recursive: true })
    writeWorkerAt('libs/builder/src/bin/native/worker/index.ts')
    expect(resolveDefaultInjectWorkerPath(root)).toBeUndefined()
  })
})
