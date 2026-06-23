import type { InjectWorkerJob } from './types'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inject } from 'postject'
import { runInjectWorkerJob } from './job-runner'
jest.mock('postject', () => ({ inject: jest.fn().mockResolvedValue(undefined) }))

const mockInject = inject as jest.Mock

describe('runInjectWorkerJob', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-inject-worker-'))
    mockInject.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const baseJob = (overrides: Partial<InjectWorkerJob> = {}): InjectWorkerJob => {
    const hostBinary = join(root, 'fake-node')
    writeFileSync(hostBinary, Buffer.from('fake-host-binary-bytes-with-NODE_SEA_FUSE_marker'))
    const blobPath = join(root, 'sea.blob')
    writeFileSync(blobPath, Buffer.from('blob-bytes'))
    return {
      hostBinary,
      outputBinary: join(root, 'out', 'cli.linux-x64'),
      blobPath,
      resourceName: 'NODE_SEA_BLOB',
      machoSegmentName: 'NODE_SEA',
      sentinelFuse: 'NODE_SEA_FUSE_xxxxx',
      reportPath: join(root, 'reports', 'report.json'),
      ...overrides,
    }
  }

  it('clones the host binary into the output path before invoking postject', async () => {
    const job = baseJob()
    await runInjectWorkerJob(job)
    expect(statSync(job.outputBinary).size).toBe(statSync(job.hostBinary).size)
  })

  it('reads the blob from disk and forwards it to postject.inject as a Buffer', async () => {
    const job = baseJob()
    await runInjectWorkerJob(job)
    expect(mockInject).toHaveBeenCalledTimes(1)
    const [filename, resourceName, resourceData, options] = mockInject.mock.calls[0]
    expect(filename).toBe(job.outputBinary)
    expect(resourceName).toBe('NODE_SEA_BLOB')
    expect(Buffer.isBuffer(resourceData)).toBe(true)
    expect(resourceData.toString()).toBe('blob-bytes')
    expect(options).toEqual({ machoSegmentName: 'NODE_SEA', sentinelFuse: 'NODE_SEA_FUSE_xxxxx' })
  })

  it('creates the parent directories for outputBinary and reportPath when missing', async () => {
    const job = baseJob({
      outputBinary: join(root, 'nested', 'deep', 'out', 'cli'),
      reportPath: join(root, 'nested', 'deep', 'reports', 'report.json'),
    })
    await runInjectWorkerJob(job)
    expect(statSync(job.outputBinary).isFile()).toBe(true)
    expect(statSync(job.reportPath).isFile()).toBe(true)
  })

  it('writes the report JSON to job.reportPath and returns the same shape', async () => {
    const job = baseJob()
    const report = await runInjectWorkerJob(job)
    expect(report.outputSize).toBeGreaterThan(0)
    expect(report.endHeapMB).toBeGreaterThan(0)
    expect(report.endRssMB).toBeGreaterThan(0)
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
    const persisted = JSON.parse(readFileSync(job.reportPath, 'utf8'))
    expect(persisted).toEqual(report)
  })

  it('propagates rejections from postject.inject', async () => {
    mockInject.mockRejectedValueOnce(new Error('postject boom'))
    await expect(runInjectWorkerJob(baseJob())).rejects.toThrow('postject boom')
  })

  it('passes the resourceName, machoSegmentName, and sentinelFuse straight through to postject', async () => {
    await runInjectWorkerJob(
      baseJob({
        resourceName: 'CUSTOM_RES',
        machoSegmentName: '__CUSTOM_SEG',
        sentinelFuse: 'CUSTOM_FUSE',
      })
    )
    const [, resourceName, , options] = mockInject.mock.calls[0]
    expect(resourceName).toBe('CUSTOM_RES')
    expect(options).toEqual({ machoSegmentName: '__CUSTOM_SEG', sentinelFuse: 'CUSTOM_FUSE' })
  })
})
