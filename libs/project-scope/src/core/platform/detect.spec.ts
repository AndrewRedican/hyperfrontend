import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { detectPlatform, getPlatformInfo, detectCaseSensitivity, isCaseSensitiveFs, isWindows, isMac, isLinux } from './detect'

describe('core/platform/detect', () => {
  describe('detectPlatform', () => {
    it('returns platform info object', () => {
      expect(detectPlatform()).toEqual({
        os: expect.any(String),
        arch: expect.any(String),
        nodeVersion: expect.any(String),
        isWindows: expect.any(Boolean),
        isMac: expect.any(Boolean),
        isLinux: expect.any(Boolean),
        caseSensitive: expect.any(Boolean),
        pathSeparator: expect.any(String),
        lineEnding: expect.any(String),
      })
    })

    it('has valid os value', () => {
      const info = detectPlatform()
      expect(['win32', 'darwin', 'linux', 'freebsd', 'sunos', 'aix', 'other']).toContain(info.os)
    })

    it('has valid path separator', () => {
      const info = detectPlatform()
      expect(['/', '\\']).toContain(info.pathSeparator)
    })
  })

  describe('getPlatformInfo', () => {
    it('returns same cached instance', () => {
      const info1 = getPlatformInfo()
      const info2 = getPlatformInfo()
      expect(info1).toBe(info2)
    })
  })

  describe('detectCaseSensitivity', () => {
    it('returns boolean', () => {
      expect(typeof detectCaseSensitivity()).toBe('boolean')
    })

    it('returns cached value on subsequent calls', () => {
      const result1 = detectCaseSensitivity()
      const result2 = detectCaseSensitivity()
      expect(result1).toBe(result2)
    })
  })

  describe('isCaseSensitiveFs', () => {
    it('returns boolean', () => {
      expect(typeof isCaseSensitiveFs()).toBe('boolean')
    })

    it('returns same value as detectCaseSensitivity', () => {
      expect(isCaseSensitiveFs()).toBe(detectCaseSensitivity())
    })
  })

  describe('isWindows', () => {
    it('returns boolean', () => {
      expect(typeof isWindows()).toBe('boolean')
    })
  })

  describe('isMac', () => {
    it('returns boolean', () => {
      expect(typeof isMac()).toBe('boolean')
    })
  })

  describe('isLinux', () => {
    it('returns boolean', () => {
      expect(typeof isLinux()).toBe('boolean')
    })
  })
})

describe('core/platform/detect with mocked platforms', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('detectCaseSensitivity on win32', () => {
    it('returns false for Windows platform', async () => {
      jest.replaceProperty(process, 'platform', 'win32')
      const { detectCaseSensitivity: detect } = await import('./detect')
      expect(detect()).toBe(false)
    })
  })

  describe('detectCaseSensitivity on darwin', () => {
    it('returns false for macOS platform (default HFS+/APFS)', async () => {
      jest.replaceProperty(process, 'platform', 'darwin')
      const { detectCaseSensitivity: detect } = await import('./detect')
      expect(detect()).toBe(false)
    })
  })

  describe('detectCaseSensitivity on linux with fs error', () => {
    it('returns true when file write fails', async () => {
      jest.replaceProperty(process, 'platform', 'linux')
      jest.doMock('node:fs', () => ({
        writeFileSync: jest.fn(() => {
          throw new Error('EACCES: permission denied')
        }),
        existsSync: jest.fn(),
        unlinkSync: jest.fn(),
      }))
      const { detectCaseSensitivity: detect } = await import('./detect')
      expect(detect()).toBe(true)
    })
  })

  describe('getPlatformInfo for win32', () => {
    it('returns Windows-specific platform info', async () => {
      jest.replaceProperty(process, 'platform', 'win32')
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'win32'),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => 'C:\\Temp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      expect(getInfo()).toEqual(
        expect.objectContaining({ os: 'win32', isWindows: true, isMac: false, isLinux: false, pathSeparator: '\\', lineEnding: '\r\n' })
      )
    })
  })

  describe('getPlatformInfo for darwin', () => {
    it('returns macOS-specific platform info', async () => {
      jest.replaceProperty(process, 'platform', 'darwin')
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'darwin'),
        arch: jest.fn(() => 'arm64'),
        tmpdir: jest.fn(() => '/var/folders/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      expect(getInfo()).toEqual(
        expect.objectContaining({ os: 'darwin', isWindows: false, isMac: true, isLinux: false, pathSeparator: '/', lineEnding: '\n' })
      )
    })
  })

  describe('getPlatformInfo for freebsd', () => {
    it('returns freebsd platform info', async () => {
      jest.replaceProperty(process, 'platform', 'freebsd')
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'freebsd'),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => '/var/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      expect(getInfo()).toEqual(
        expect.objectContaining({ os: 'freebsd', isWindows: false, isMac: false, isLinux: false, pathSeparator: '/' })
      )
    })
  })

  describe('getPlatformInfo for sunos', () => {
    it('returns sunos platform info', async () => {
      jest.replaceProperty(process, 'platform', 'sunos')
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'sunos'),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => '/var/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      expect(getInfo()).toEqual(expect.objectContaining({ os: 'sunos', isWindows: false, isMac: false, isLinux: false }))
    })
  })

  describe('getPlatformInfo for aix', () => {
    it('returns aix platform info', async () => {
      jest.replaceProperty(process, 'platform', 'aix')
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'aix'),
        arch: jest.fn(() => 'ppc64'),
        tmpdir: jest.fn(() => '/var/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      expect(getInfo()).toEqual(expect.objectContaining({ os: 'aix', isWindows: false, isMac: false, isLinux: false }))
    })
  })

  describe('getPlatformInfo for unknown platform', () => {
    it('returns other for unrecognized platforms', async () => {
      jest.replaceProperty(process, 'platform', 'haiku')
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'haiku' as NodeJS.Platform),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => '/var/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      expect(getInfo()).toEqual(expect.objectContaining({ os: 'other', isWindows: false, isMac: false, isLinux: false }))
    })
  })
})
