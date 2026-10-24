import type { Mock } from '@hyperfrontend/testing'
import type { FakeChildProcess } from '@hyperfrontend/testing/process'
import type { MemoryMonitor, MemorySnapshot } from '../../memory/monitor'
import type { RollupBuildDescriptor } from './worker/types'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, flushPromises, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio, createFakeChildProcess } from '@hyperfrontend/testing/process'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './dispatch'
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
  descriptor: RollupBuildDescriptor
}

const captureSpawn = (records: SpawnRecord[]): Mock =>
  (spawn as Mock).mockImplementation((execPath: string, args: string[]) => {
    const child = createFakeChildProcess()
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
  ;(spawn as Mock).mockReset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('dispatchRollupWorker', () => {
  it('forks exactly one worker for a dispatch', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
    expect(records).toHaveLength(1)
  })

  it('resolves with the parsed JSON report the worker wrote', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
    ;(records[0] as SpawnRecord).child.exit(0)
    expect(await promise).toEqual({ outputSize: 100, endHeapMB: 1.5, endRssMB: 50, durationMs: 25 })
  })

  it('overwrites the descriptor reportPath with a temp-dir path before forking', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const descriptor = baseDescriptor({ reportPath: '/abs/orig.json' })
    const promise = dispatchRollupWorker(descriptor, { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    expect((records[0] as SpawnRecord).descriptor.reportPath).toContain('hf-builder-rollup-')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
  })

  it('rejects when the worker exits with a non-zero code and includes the captured stderr tail', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    captureStdio({ stdout: false })
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.writeStderr('boom oh no\n')
    ;(records[0] as SpawnRecord).child.exit(1)
    await expect(promise).rejects.toThrow(/exited with code 1[\s\S]*boom oh no/)
  })

  it('rejects when the worker reports a spawn error', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.fail(new Error('ENOENT'))
    await expect(promise).rejects.toThrow(/failed to spawn: ENOENT/)
  })

  it('rejects when the worker exits cleanly but writes no report', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.exit(0)
    await expect(promise).rejects.toThrow(/did not write a report/)
  })

  it('passes execPath and execArgv overrides to spawn', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), {
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

  it('spawns the worker without the webcrypto flag when the crypto global is present', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    expect((records[0] as SpawnRecord).args[0]).toBe('/abs/worker.cjs')
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
  })

  it('prepends --experimental-global-webcrypto when the running Node has no crypto global', async () => {
    jest.stubGlobal('crypto', undefined)
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), {
      workerPath: '/abs/worker.cjs',
      execArgv: ['--require', '@swc-node/register'],
    })
    await flushPromises()
    expect((records[0] as SpawnRecord).args.slice(0, 4)).toEqual([
      '--experimental-global-webcrypto',
      '--require',
      '@swc-node/register',
      '/abs/worker.cjs',
    ])
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
    const promise = dispatchRollupWorker(baseDescriptor(), {
      workerPath: '/abs/worker.cjs',
      monitor,
      label: 'esm:0/1:.',
    })
    await flushPromises()
    writeReport((records[0] as SpawnRecord).reportPath, { outputSize: 1, endHeapMB: 1, endRssMB: 1, durationMs: 1 })
    ;(records[0] as SpawnRecord).child.exit(0)
    await promise
    expect(checks).toEqual(['bundle:rollup:dispatch:esm:0/1:.:start', 'bundle:rollup:dispatch:esm:0/1:.:end'])
  })

  it('falls back to a format+inputFile label when no explicit label is supplied', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    ;(records[0] as SpawnRecord).child.exit(1)
    await expect(promise).rejects.toThrow(/rollup worker for esm:\/abs\/libs\/foo\/src\/index\.ts/)
  })

  it('cleans up the temporary report directory even when the job fails', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
    await flushPromises()
    const reportDir = dirname((records[0] as SpawnRecord).reportPath)
    ;(records[0] as SpawnRecord).child.exit(2)
    const outcome = await promise.then(
      () => 'resolved',
      () => 'rejected'
    )
    expect({ outcome, reportDirExists: existsSync(reportDir) }).toEqual({ outcome: 'rejected', reportDirExists: false })
  })

  it('passes stdout chunks through to the parent stdout', async () => {
    const records: SpawnRecord[] = []
    captureSpawn(records)
    const stdio = captureStdio({ stderr: false })
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
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
    const promise = dispatchRollupWorker(baseDescriptor(), { workerPath: '/abs/worker.cjs' })
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

describe('resolveDefaultRollupWorkerPath', () => {
  const dir = useTempDir({ prefix: 'builder-rollup-resolver-' })

  it('resolves the worker at the bundle/rollup/worker offset beside the builder', () => {
    const path = dir.write('bundle/rollup/worker/index.cjs', '/* fake worker */')
    expect(resolveDefaultRollupWorkerPath(dir.path)).toEqual({ path, execArgv: [] })
  })

  it('returns undefined when no rollup worker exists under any ancestor', () => {
    expect(resolveDefaultRollupWorkerPath(dir.path)).toBeUndefined()
  })
})
