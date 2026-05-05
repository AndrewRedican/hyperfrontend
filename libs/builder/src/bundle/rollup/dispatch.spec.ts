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
import type { RollupBuildDescriptor } from './worker/types'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './dispatch'

const tick = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve))

interface SpawnRecord {
  execPath: string
  args: string[]
  reportPath: string
  child: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }
  descriptor: RollupBuildDescriptor
}

const makeFakeChild = (): SpawnRecord['child'] => {
  const child = new EventEmitter() as SpawnRecord['child']
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  return child
}

const captureSpawn = (records: SpawnRecord[]): jest.Mock =>
  (<jest.Mock>spawn).mockImplementation((execPath: string, args: string[]) => {
    const child = makeFakeChild()
    const descriptorJson = args[args.length - 1] as string
    const descriptor = JSON.parse(descriptorJson) as RollupBuildDescriptor
    records.push({ execPath, args, reportPath: descriptor.reportPath, child, descriptor })
    return child as unknown as ReturnType<typeof spawn>
  })

const writeReport = (reportPath: string, payload: object): void => {
  writeFileSync(reportPath, JSON.stringify(payload))
}

const baseDescriptor = (overrides: Partial<RollupBuildDescriptor> = {}): RollupBuildDescriptor => ({
  format: 'esm',
  inputFile: '/abs/libs/foo/src/index.ts',
  outputDir: '/abs/dist/libs/foo',
  external: [],
  sourcemap: true,
  bundledDepsPlugin: null,
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  bundleWorkspaceDeps: false,
  bundle: null,
  reportPath: '/abs/will-be-overwritten',
  ...overrides,
})

beforeEach(() => {
  ;(<jest.Mock>spawn).mockReset()
})

describe('dispatchRollupWorker', () => {
  it('forks the worker, reads the JSON report, and resolves with the parsed value', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const descriptor = baseDescriptor()
    const promise = dispatchRollupWorker(descriptor, { workerPath: '/abs/worker.cjs.js' })
    await tick()
    expect(records).toHaveLength(1)
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 100, peakHeapMB: 1.5, peakRssMB: 50, durationMs: 25 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    const result = await promise
    expect(result).toEqual({ outputSize: 100, peakHeapMB: 1.5, peakRssMB: 50, durationMs: 25 })
  })

  it('overwrites the descriptor reportPath with a temp-dir path before forking', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const descriptor = baseDescriptor({ reportPath: '/abs/orig.json' })
    const promise = dispatchRollupWorker(descriptor, { workerPath: '/abs/worker.cjs.js' })
    await tick()
    expect((<SpawnRecord>records[0]).descriptor.reportPath).not.toBe('/abs/orig.json')
    expect((<SpawnRecord>records[0]).descriptor.reportPath).toContain('hf-builder-rollup-')
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 1, peakHeapMB: 1, peakRssMB: 1, durationMs: 1 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await promise
  })

  it('rejects when the worker exits with a non-zero code and includes the captured stderr tail', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.stderr.emit('data', Buffer.from('boom oh no\n'))
    ;(<SpawnRecord>records[0]).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/exited with code 1[\s\S]*boom oh no/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.emit('error', new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await expect(promise).rejects.toThrow(/did not write a report/)
  })

  it('passes execPath and execArgv overrides to spawn', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), {
      workerPath: '/abs/worker.cjs.js',
      execPath: '/usr/bin/custom-node',
      execArgv: ['--require', '@swc-node/register'],
    })
    await tick()
    expect((<SpawnRecord>records[0]).execPath).toBe('/usr/bin/custom-node')
    expect((<SpawnRecord>records[0]).args.slice(0, 3)).toEqual(['--require', '@swc-node/register', '/abs/worker.cjs.js'])
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 1, peakHeapMB: 1, peakRssMB: 1, durationMs: 1 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
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
    const promise = dispatchRollupWorker(baseDescriptor(), {
      workerPath: '/abs/worker.cjs.js',
      monitor,
      label: 'esm:0/1:.',
    })
    await tick()
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 1, peakHeapMB: 1, peakRssMB: 1, durationMs: 1 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await promise
    expect(checks).toEqual(['bundle:rollup:dispatch:esm:0/1:.:start', 'bundle:rollup:dispatch:esm:0/1:.:end'])
  })

  it('falls back to a format+inputFile label when no explicit label is supplied', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/rollup worker for esm:\/abs\/libs\/foo\/src\/index\.ts/)
  })

  it('cleans up the temporary report directory even when the job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    const reportDir = (<SpawnRecord>records[0]).reportPath.substring(0, (<SpawnRecord>records[0]).reportPath.lastIndexOf('/'))
    ;(<SpawnRecord>records[0]).child.emit('exit', 2)
    await expect(promise).rejects.toThrow()
    expect(existsSync(reportDir)).toBe(false)
  })

  it('passes stdout chunks through to the parent stdout', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.stdout.emit('data', Buffer.from('child output\n'))
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 1, peakHeapMB: 1, peakRssMB: 1, durationMs: 1 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await promise
    expect(writeSpy).toHaveBeenCalledWith(expect.anything())
    writeSpy.mockRestore()
  })

  it('passes stderr string chunks through to the parent stderr', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(<SpawnRecord>records[0]).child.stderr.emit('data', 'string chunk\n')
    writeReport((<SpawnRecord>records[0]).reportPath, { outputSize: 1, peakHeapMB: 1, peakRssMB: 1, durationMs: 1 })
    ;(<SpawnRecord>records[0]).child.emit('exit', 0)
    await promise
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('string chunk'))
    writeSpy.mockRestore()
  })
})

describe('resolveDefaultRollupWorkerPath', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-rollup-resolver-'))
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
    expect(resolveDefaultRollupWorkerPath(root)).toBeUndefined()
  })

  it('returns the dist path when the dist worker exists', () => {
    const targetDir = join(root, 'dist', 'libs', 'builder', 'bundle', 'rollup', 'worker')
    require('node:fs').mkdirSync(targetDir, { recursive: true })
    const path = writeWorkerAt('dist/libs/builder/bundle/rollup/worker/index.cjs.js')
    expect(resolveDefaultRollupWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('falls back to node_modules when the dist worker is missing', () => {
    const targetDir = join(root, 'node_modules', '@hyperfrontend', 'builder', 'bundle', 'rollup', 'worker')
    require('node:fs').mkdirSync(targetDir, { recursive: true })
    const path = writeWorkerAt('node_modules/@hyperfrontend/builder/bundle/rollup/worker/index.cjs.js')
    expect(resolveDefaultRollupWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('prefers the dist worker when both are present', () => {
    const distDir = join(root, 'dist', 'libs', 'builder', 'bundle', 'rollup', 'worker')
    const nmDir = join(root, 'node_modules', '@hyperfrontend', 'builder', 'bundle', 'rollup', 'worker')
    require('node:fs').mkdirSync(distDir, { recursive: true })
    require('node:fs').mkdirSync(nmDir, { recursive: true })
    const distPath = writeWorkerAt('dist/libs/builder/bundle/rollup/worker/index.cjs.js')
    writeWorkerAt('node_modules/@hyperfrontend/builder/bundle/rollup/worker/index.cjs.js')
    expect(resolveDefaultRollupWorkerPath(root)).toEqual({ path: distPath, execArgv: [] })
  })

  it('falls back to the in-source worker.ts via @swc-node/register when dist+node_modules are missing', () => {
    const sourceDir = join(root, 'libs', 'builder', 'src', 'bundle', 'rollup', 'worker')
    const swcDir = join(root, 'node_modules', '@swc-node', 'register')
    require('node:fs').mkdirSync(sourceDir, { recursive: true })
    require('node:fs').mkdirSync(swcDir, { recursive: true })
    const sourcePath = writeWorkerAt('libs/builder/src/bundle/rollup/worker/index.ts')
    writeWorkerAt('node_modules/@swc-node/register/index.js')
    expect(resolveDefaultRollupWorkerPath(root)).toEqual({ path: sourcePath, execArgv: ['--require', '@swc-node/register'] })
  })

  it('returns undefined when only the source worker.ts is present but @swc-node/register is missing', () => {
    const sourceDir = join(root, 'libs', 'builder', 'src', 'bundle', 'rollup', 'worker')
    require('node:fs').mkdirSync(sourceDir, { recursive: true })
    writeWorkerAt('libs/builder/src/bundle/rollup/worker/index.ts')
    expect(resolveDefaultRollupWorkerPath(root)).toBeUndefined()
  })
})
