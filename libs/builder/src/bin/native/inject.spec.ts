import { copyFileSync, readFileSync } from 'node:fs'
import { inject } from 'postject'
import { injectBlob, NODE_SEA_FUSE, NODE_SEA_MACHO_SEGMENT, NODE_SEA_RESOURCE_NAME } from './inject'
jest.mock('node:fs', () => ({ copyFileSync: jest.fn(), readFileSync: jest.fn() }))
jest.mock('postject', () => ({ inject: jest.fn().mockResolvedValue(undefined) }))

const mockCopy = copyFileSync as jest.Mock
const mockRead = readFileSync as jest.Mock
const mockInject = inject as jest.Mock

beforeEach(() => {
  mockCopy.mockReset()
  mockRead.mockReset()
  mockInject.mockReset()
  mockInject.mockResolvedValue(undefined)
  mockRead.mockReturnValue(Buffer.from('blob-bytes'))
})

describe('injectBlob', () => {
  it('clones the host binary to the output binary path before injecting', async () => {
    await injectBlob({ hostBinary: '/opt/node', outputBinary: '/dist/cli.linux-x64', blobPath: '/dist/cli.blob' })
    expect(mockCopy).toHaveBeenCalledWith('/opt/node', '/dist/cli.linux-x64')
  })

  it('reads the blob from disk and forwards it to postject.inject', async () => {
    await injectBlob({ hostBinary: '/opt/node', outputBinary: '/dist/cli', blobPath: '/dist/cli.blob' })
    expect(mockRead).toHaveBeenCalledWith('/dist/cli.blob')
    const [filename, resourceName, resourceData] = mockInject.mock.calls[0]
    expect(filename).toBe('/dist/cli')
    expect(resourceName).toBe(NODE_SEA_RESOURCE_NAME)
    expect(Buffer.isBuffer(resourceData)).toBe(true)
    expect(resourceData.toString()).toBe('blob-bytes')
  })

  it('passes the default macho segment name and sentinel fuse to postject', async () => {
    await injectBlob({ hostBinary: '/opt/node', outputBinary: '/dist/cli', blobPath: '/dist/cli.blob' })
    expect(mockInject.mock.calls[0][3]).toEqual({
      machoSegmentName: NODE_SEA_MACHO_SEGMENT,
      sentinelFuse: NODE_SEA_FUSE,
    })
  })

  it('honors a custom resourceName override', async () => {
    await injectBlob({
      hostBinary: '/opt/node',
      outputBinary: '/dist/cli',
      blobPath: '/dist/cli.blob',
      resourceName: 'CUSTOM_NAME',
    })
    expect(mockInject.mock.calls[0][1]).toBe('CUSTOM_NAME')
  })

  it('honors a custom machoSegmentName override', async () => {
    await injectBlob({
      hostBinary: '/opt/node',
      outputBinary: '/dist/cli',
      blobPath: '/dist/cli.blob',
      machoSegmentName: '__CUSTOM',
    })
    expect(mockInject.mock.calls[0][3].machoSegmentName).toBe('__CUSTOM')
  })

  it('honors a custom sentinelFuse override', async () => {
    await injectBlob({
      hostBinary: '/opt/node',
      outputBinary: '/dist/cli',
      blobPath: '/dist/cli.blob',
      sentinelFuse: 'CUSTOM_FUSE',
    })
    expect(mockInject.mock.calls[0][3].sentinelFuse).toBe('CUSTOM_FUSE')
  })

  it('exposes the Node SEA defaults as named constants', () => {
    expect(NODE_SEA_RESOURCE_NAME).toBe('NODE_SEA_BLOB')
    expect(NODE_SEA_MACHO_SEGMENT).toBe('NODE_SEA')
    expect(NODE_SEA_FUSE).toBe('NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2')
  })

  it('propagates rejections from postject.inject', async () => {
    mockInject.mockRejectedValueOnce(new Error('inject failed'))
    await expect(injectBlob({ hostBinary: '/opt/node', outputBinary: '/dist/cli', blobPath: '/dist/cli.blob' })).rejects.toThrow(
      'inject failed'
    )
  })
})
