import type { SpawnSyncReturns } from 'node:child_process'
import type { Mock } from '@hyperfrontend/testing'
import { spawnSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { generateSeaBlob } from './sea-blob'
jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))

const mockSpawn = spawnSync as Mock

const okResult = (): SpawnSyncReturns<string> => ({
  pid: 1,
  output: ['', '', ''],
  stdout: '',
  stderr: '',
  status: 0,
  signal: null,
})

beforeEach(() => mockSpawn.mockReset())

describe('generateSeaBlob', () => {
  it('spawns process.execPath with --experimental-sea-config and the config path', () => {
    mockSpawn.mockReturnValueOnce(okResult())
    generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/blob' })
    expect(mockSpawn).toHaveBeenCalledWith(process.execPath, ['--experimental-sea-config', '/cfg.json'], { encoding: 'utf8' })
  })

  it('honors a custom node executable override', () => {
    mockSpawn.mockReturnValueOnce(okResult())
    generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/blob', nodeExecutable: '/usr/local/bin/node20' })
    expect(mockSpawn).toHaveBeenCalledWith('/usr/local/bin/node20', ['--experimental-sea-config', '/cfg.json'], { encoding: 'utf8' })
  })

  it('returns the supplied output blob path on success', () => {
    mockSpawn.mockReturnValueOnce(okResult())
    const result = generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/abs/blob.bin' })
    expect(result).toEqual({ blobPath: '/abs/blob.bin', status: 0 })
  })

  it('rethrows the spawn error when the child process fails to start', () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockSpawn.mockReturnValueOnce({ ...okResult(), error: err, status: null })
    expect(() => generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/blob' })).toThrow('ENOENT')
  })

  it('throws with the captured stderr when the exit status is non-zero', () => {
    mockSpawn.mockReturnValueOnce({ ...okResult(), status: 2, stderr: 'cannot read sea config\n' })
    expect(() => generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/blob' })).toThrow(
      /failed with status 2: cannot read sea config/
    )
  })

  it('throws when the exit status is null (signal-terminated)', () => {
    mockSpawn.mockReturnValueOnce({ ...okResult(), status: null, stderr: '' })
    expect(() => generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/blob' })).toThrow(/failed with status null/)
  })

  it('omits the stderr suffix when stderr is empty', () => {
    mockSpawn.mockReturnValueOnce({ ...okResult(), status: 1, stderr: '' })
    expect(() => generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/blob' })).toThrow(
      'node --experimental-sea-config failed with status 1'
    )
  })

  it('handles a missing stderr field by treating it as empty', () => {
    mockSpawn.mockReturnValueOnce({ ...okResult(), status: 1, stderr: undefined as unknown as string })
    expect(() => generateSeaBlob({ seaConfigPath: '/cfg.json', outputBlobPath: '/blob' })).toThrow(
      'node --experimental-sea-config failed with status 1'
    )
  })
})
