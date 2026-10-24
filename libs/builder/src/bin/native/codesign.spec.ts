import type { Mock } from '@hyperfrontend/testing'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { spawnSyncResult } from '@hyperfrontend/testing/process'
import { applyCodesign, removeCodesign } from './codesign'
jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))

const mockSpawn = spawnSync as Mock

beforeEach(() => mockSpawn.mockReset())

afterEach(() => jest.restoreAllMocks())

describe('removeCodesign', () => {
  it('reports that it did not run on non-macOS hosts', () => {
    jest.replaceProperty(process, 'platform', 'linux')
    const result = removeCodesign({ binary: '/dist/cli' })
    expect(result).toEqual({ ran: false, status: null, stderr: '' })
  })

  it('spawns no codesign process on non-macOS hosts', () => {
    jest.replaceProperty(process, 'platform', 'linux')
    removeCodesign({ binary: '/dist/cli' })
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('invokes codesign --remove-signature on macOS', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    removeCodesign({ binary: '/dist/cli' })
    expect(mockSpawn).toHaveBeenCalledWith('codesign', ['--remove-signature', '/dist/cli'], { encoding: 'utf8' })
  })

  it('reports a successful removal on macOS', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    const result = removeCodesign({ binary: '/dist/cli' })
    expect(result).toEqual({ ran: true, status: 0, stderr: '' })
  })

  it('captures stderr from a failed remove-signature call', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult({ stderr: 'not signed\n', status: 1 }))
    const result = removeCodesign({ binary: '/dist/cli' })
    expect(result).toEqual({ ran: true, status: 1, stderr: 'not signed\n' })
  })

  it('reports a null status when codesign returns no exit code (signal-terminated)', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult({ status: null }))
    const result = removeCodesign({ binary: '/dist/cli' })
    expect(result).toMatchObject({ ran: true, status: null })
  })

  it('treats a missing stderr field as an empty string', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce({ ...spawnSyncResult(), stderr: undefined as unknown as string })
    const result = removeCodesign({ binary: '/dist/cli' })
    expect(result.stderr).toBe('')
  })
})

describe('applyCodesign', () => {
  it('reports that it did not run on non-macOS hosts', () => {
    jest.replaceProperty(process, 'platform', 'win32')
    const result = applyCodesign({ binary: '/dist/cli' })
    expect(result).toEqual({ ran: false, status: null, stderr: '' })
  })

  it('spawns no codesign process on non-macOS hosts', () => {
    jest.replaceProperty(process, 'platform', 'win32')
    applyCodesign({ binary: '/dist/cli' })
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('uses ad-hoc identity (-) by default on macOS', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    applyCodesign({ binary: '/dist/cli' })
    expect(mockSpawn).toHaveBeenCalledWith('codesign', ['--sign', '-', '/dist/cli'], { encoding: 'utf8' })
  })

  it('forwards a custom signing identity', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    applyCodesign({ binary: '/dist/cli', identity: 'Developer ID Application: ACME (XYZ)' })
    expect(mockSpawn).toHaveBeenCalledWith('codesign', ['--sign', 'Developer ID Application: ACME (XYZ)', '/dist/cli'], {
      encoding: 'utf8',
    })
  })

  it('returns ran=true and forwards exit status / stderr from the spawn', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult({ stderr: 'done\n', status: 0 }))
    const result = applyCodesign({ binary: '/dist/cli' })
    expect(result).toEqual({ ran: true, status: 0, stderr: 'done\n' })
  })

  it('reports a null status when codesign is signal-terminated', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce(spawnSyncResult({ status: null }))
    const result = applyCodesign({ binary: '/dist/cli' })
    expect(result.status).toBeNull()
  })

  it('treats a missing stderr field as an empty string', () => {
    jest.replaceProperty(process, 'platform', 'darwin')
    mockSpawn.mockReturnValueOnce({ ...spawnSyncResult(), stderr: undefined as unknown as string })
    const result = applyCodesign({ binary: '/dist/cli' })
    expect(result.stderr).toBe('')
  })
})
