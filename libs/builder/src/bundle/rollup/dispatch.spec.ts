import type { MemoryMonitor, MemorySnapshot } from '../../memory/monitor'
import type { RollupBuildDescriptor } from './worker/types'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './dispatch'
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
  descriptor: RollupBuildDescriptor
}

const makeFakeChild = (): SpawnRecord['child'] => {
  const child = new EventEmitter() as SpawnRecord['child']
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  return child
}

const captureSpawn = (records: SpawnRecord[]): jest.Mock =>
  (spawn as jest.Mock).mockImplementation((execPath: string, args: string[]) => {
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
  workspaceRoutes: [],
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  bundleWorkspaceDeps: false,
  bundle: null,
  bin: null,
  reportPath: '/abs/will-be-overwritten',
  ...overrides,
})

beforeEach(() => {
  ;(spawn as jest.Mock).mockReset()
})

describe('dispatchRollupWorker', () => {
  it('forks the worker, reads the JSON report, and resolves with the parsed value', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const descriptor = baseDescriptor()
    const promise = dispatchRollupWorker(descriptor, { workerPath: '/abs/worker.cjs.js' })
    await tick()
    expect(records).toHaveLength(1)
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    const result = await promise
    expect(result).toEqual({ outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
  })

  it('overwrites the descriptor reportPath with a temp-dir path before forking', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const descriptor = baseDescriptor({ reportPath: '/abs/orig.json' })
    const promise = dispatchRollupWorker(descriptor, { workerPath: '/abs/worker.cjs.js' })
    await tick()
    expect((records[0] as SpawnRecord).descriptor.reportPath).not.toBe('/abs/orig.json')
    expect((records[0] as SpawnRecord).descriptor.reportPath).toContain('hf-builder-rollup-')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await promise
  })

  it('rejects when the worker exits with a non-zero code and includes the captured stderr tail', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.stderr.emit('data', Buffer.from('boom oh no\n'))
    ;(records[0] as SpawnRecord).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/exited with code 1[\s\S]*boom oh no/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('error', new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
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
    const promise = dispatchRollupWorker(baseDescriptor(), {
      workerPath: '/abs/worker.cjs.js',
      monitor,
      label: 'esm:0/1:.',
    })
    await tick()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
    await promise
    expect(checks).toEqual(['bundle:rollup:dispatch:esm:0/1:.:start', 'bundle:rollup:dispatch:esm:0/1:.:end'])
  })

  it('falls back to a format+inputFile label when no explicit label is supplied', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.emit('exit', 1)
    await expect(promise).rejects.toThrow(/rollup worker for esm:\/abs\/libs\/foo\/src\/index\.ts/)
  })

  it('cleans up the temporary report directory even when the job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
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
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
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
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs.js' })
    await tick()
    ;(records[0] as SpawnRecord).child.stderr.emit('data', 'string chunk\n')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.emit('exit', 0)
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

  it('resolves the worker at the bundle/rollup/worker offset beside the builder', () => {
    const targetDir = join(root, 'bundle', 'rollup', 'worker')
    mkdirSync(targetDir, { recursive: true })
    const path = join(targetDir, 'index.cjs.js')
    writeFileSync(path, '/* fake worker */', { flag: 'w' })
    expect(resolveDefaultRollupWorkerPath(root)).toEqual({ path, execArgv: [] })
  })

  it('returns undefined when no rollup worker exists under any ancestor', () => {
    expect(resolveDefaultRollupWorkerPath(root)).toBeUndefined()
  })
})
