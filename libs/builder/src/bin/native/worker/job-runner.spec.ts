import type { Mock } from '@hyperfrontend/testing'
import type { InjectWorkerJob } from './types'
import { readFileSync, statSync } from 'node:fs'
import { beforeEach } from 'node:test'
import { inject } from 'postject'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { runInjectWorkerJob } from './job-runner'
jest.mock('postject', () => ({ inject: jest.fn().mockResolvedValue(undefined) }))

const mockInject = inject as Mock

describe('runInjectWorkerJob', () => {
  const dir = useTempDir({ prefix: 'builder-inject-worker-' })

  beforeEach(() => {
    mockInject.mockReset().mockResolvedValue(undefined)
  })

  const baseJob = (overrides: Partial<InjectWorkerJob> = {}): InjectWorkerJob => {
    const hostBinary = dir.write('fake-node', Buffer.from('fake-host-binary-bytes-with-NODE_SEA_FUSE_marker'))
    const blobPath = dir.write('sea.blob', Buffer.from('blob-bytes'))
    return {
      hostBinary,
      outputBinary: dir.resolve('out', 'cli.linux-x64'),
      blobPath,
      resourceName: 'NODE_SEA_BLOB',
      machoSegmentName: 'NODE_SEA',
      sentinelFuse: 'NODE_SEA_FUSE_xxxxx',
      reportPath: dir.resolve('reports', 'report.json'),
      ...overrides,
    }
  }

  it('clones the host binary into the output path before invoking postject', async () => {
    const job = baseJob()
    await runInjectWorkerJob(job)
    expect(statSync(job.outputBinary).size).toBe(statSync(job.hostBinary).size)
  })

  it('reads the blob from disk and forwards it to postject.inject as a Buffer in a single call', async () => {
    const job = baseJob()
    await runInjectWorkerJob(job)
    expect(mockInject.mock.calls).toEqual([
      [job.outputBinary, 'NODE_SEA_BLOB', Buffer.from('blob-bytes'), { machoSegmentName: 'NODE_SEA', sentinelFuse: 'NODE_SEA_FUSE_xxxxx' }],
    ])
  })

  it('creates the missing parent directories of outputBinary', async () => {
    const job = baseJob({ outputBinary: dir.resolve('nested', 'deep', 'out', 'cli') })
    await runInjectWorkerJob(job)
    expect(statSync(job.outputBinary).isFile()).toBe(true)
  })

  it('creates the missing parent directories of reportPath', async () => {
    const job = baseJob({ reportPath: dir.resolve('nested', 'deep', 'reports', 'report.json') })
    await runInjectWorkerJob(job)
    expect(statSync(job.reportPath).isFile()).toBe(true)
  })

  it('reports a positive output size', async () => {
    const report = await runInjectWorkerJob(baseJob())
    expect(report.outputSize).toBeGreaterThan(0)
  })

  it('reports a positive end heap measurement', async () => {
    const report = await runInjectWorkerJob(baseJob())
    expect(report.endHeapMB).toBeGreaterThan(0)
  })

  it('reports a positive end rss measurement', async () => {
    const report = await runInjectWorkerJob(baseJob())
    expect(report.endRssMB).toBeGreaterThan(0)
  })

  it('reports a non-negative duration', async () => {
    const report = await runInjectWorkerJob(baseJob())
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('persists the returned report as JSON at job.reportPath', async () => {
    const job = baseJob()
    const report = await runInjectWorkerJob(job)
    expect(JSON.parse(readFileSync(job.reportPath, 'utf8'))).toEqual(report)
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
    expect({ resourceName, options }).toEqual({
      resourceName: 'CUSTOM_RES',
      options: { machoSegmentName: '__CUSTOM_SEG', sentinelFuse: 'CUSTOM_FUSE' },
    })
  })
})
