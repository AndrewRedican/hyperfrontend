import type { SpawnSyncReturns } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { applyCodesign, removeCodesign } from './codesign'
jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))

const mockSpawn = spawnSync as jest.Mock

const okResult = (stderr = ''): SpawnSyncReturns<string> => ({
  pid: 1,
  output: ['', '', ''],
  stdout: '',
  stderr,
  status: 0,
  signal: null,
})

const setPlatform = (platform: NodeJS.Platform): (() => void) => {
  const original = process.platform
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  return () => Object.defineProperty(process, 'platform', { value: original, configurable: true })
}

beforeEach(() => mockSpawn.mockReset())

describe('removeCodesign', () => {
  it('skips silently on non-macOS hosts', () => {
    const restore = setPlatform('linux')
    try {
      const result = removeCodesign({ binary: '/dist/cli' })
      expect(result).toEqual({ ran: false, status: null, stderr: '' })
      expect(mockSpawn).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('invokes codesign --remove-signature on macOS', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce(okResult())
      const result = removeCodesign({ binary: '/dist/cli' })
      expect(mockSpawn).toHaveBeenCalledWith('codesign', ['--remove-signature', '/dist/cli'], { encoding: 'utf8' })
      expect(result).toEqual({ ran: true, status: 0, stderr: '' })
    } finally {
      restore()
    }
  })

  it('captures stderr from a failed remove-signature call', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce({ ...okResult('not signed\n'), status: 1 })
      const result = removeCodesign({ binary: '/dist/cli' })
      expect(result).toEqual({ ran: true, status: 1, stderr: 'not signed\n' })
    } finally {
      restore()
    }
  })

  it('reports a null status when codesign returns no exit code (signal-terminated)', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce({ ...okResult(), status: null })
      const result = removeCodesign({ binary: '/dist/cli' })
      expect(result.status).toBeNull()
      expect(result.ran).toBe(true)
    } finally {
      restore()
    }
  })

  it('treats a missing stderr field as an empty string', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce({ ...okResult(), stderr: undefined as unknown as string })
      const result = removeCodesign({ binary: '/dist/cli' })
      expect(result.stderr).toBe('')
    } finally {
      restore()
    }
  })
})

describe('applyCodesign', () => {
  it('skips silently on non-macOS hosts', () => {
    const restore = setPlatform('win32')
    try {
      const result = applyCodesign({ binary: '/dist/cli' })
      expect(result).toEqual({ ran: false, status: null, stderr: '' })
      expect(mockSpawn).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('uses ad-hoc identity (-) by default on macOS', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce(okResult())
      applyCodesign({ binary: '/dist/cli' })
      expect(mockSpawn).toHaveBeenCalledWith('codesign', ['--sign', '-', '/dist/cli'], { encoding: 'utf8' })
    } finally {
      restore()
    }
  })

  it('forwards a custom signing identity', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce(okResult())
      applyCodesign({ binary: '/dist/cli', identity: 'Developer ID Application: ACME (XYZ)' })
      expect(mockSpawn).toHaveBeenCalledWith('codesign', ['--sign', 'Developer ID Application: ACME (XYZ)', '/dist/cli'], {
        encoding: 'utf8',
      })
    } finally {
      restore()
    }
  })

  it('returns ran=true and forwards exit status / stderr from the spawn', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce({ ...okResult('done\n'), status: 0 })
      const result = applyCodesign({ binary: '/dist/cli' })
      expect(result).toEqual({ ran: true, status: 0, stderr: 'done\n' })
    } finally {
      restore()
    }
  })

  it('reports a null status when codesign is signal-terminated', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce({ ...okResult(), status: null })
      const result = applyCodesign({ binary: '/dist/cli' })
      expect(result.status).toBeNull()
    } finally {
      restore()
    }
  })

  it('treats a missing stderr field as an empty string', () => {
    const restore = setPlatform('darwin')
    try {
      mockSpawn.mockReturnValueOnce({ ...okResult(), stderr: undefined as unknown as string })
      const result = applyCodesign({ binary: '/dist/cli' })
      expect(result.stderr).toBe('')
    } finally {
      restore()
    }
  })
})
