import { detectPlatform, getPlatformInfo, detectCaseSensitivity, isCaseSensitiveFs, isWindows, isMac, isLinux } from './detect'

// Store original platform value for restoration
const originalPlatform = process.platform

describe('core/platform/detect', () => {
  describe('detectPlatform', () => {
    it('returns platform info object', () => {
      const info = detectPlatform()
      expect(info).toHaveProperty('os')
      expect(info).toHaveProperty('arch')
      expect(info).toHaveProperty('isWindows')
      expect(info).toHaveProperty('isMac')
      expect(info).toHaveProperty('isLinux')
      expect(info).toHaveProperty('pathSeparator')
      expect(info).toHaveProperty('lineEnding')
      expect(info).toHaveProperty('caseSensitive')
      expect(info).toHaveProperty('nodeVersion')
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
      expect(info1).toBe(info2) // Same reference
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
  // These tests require isolating module state
  beforeEach(() => {
    jest.resetModules()
  })

  afterAll(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  describe('detectCaseSensitivity on win32', () => {
    it('returns false for Windows platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
      const { detectCaseSensitivity: detect } = await import('./detect')
      expect(detect()).toBe(false)
    })
  })

  describe('detectCaseSensitivity on darwin', () => {
    it('returns false for macOS platform (default HFS+/APFS)', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      const { detectCaseSensitivity: detect } = await import('./detect')
      expect(detect()).toBe(false)
    })
  })

  describe('detectCaseSensitivity on linux with fs error', () => {
    it('returns true when file write fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
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
      Object.defineProperty(process, 'platform', { value: 'win32' })
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'win32'),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => 'C:\\Temp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      const info = getInfo()
      expect(info.os).toBe('win32')
      expect(info.isWindows).toBe(true)
      expect(info.isMac).toBe(false)
      expect(info.isLinux).toBe(false)
      expect(info.pathSeparator).toBe('\\')
      expect(info.lineEnding).toBe('\r\n')
    })
  })

  describe('getPlatformInfo for darwin', () => {
    it('returns macOS-specific platform info', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'darwin'),
        arch: jest.fn(() => 'arm64'),
        tmpdir: jest.fn(() => '/var/folders/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      const info = getInfo()
      expect(info.os).toBe('darwin')
      expect(info.isWindows).toBe(false)
      expect(info.isMac).toBe(true)
      expect(info.isLinux).toBe(false)
      expect(info.pathSeparator).toBe('/')
      expect(info.lineEnding).toBe('\n')
    })
  })

  describe('getPlatformInfo for freebsd', () => {
    it('returns freebsd platform info', async () => {
      Object.defineProperty(process, 'platform', { value: 'freebsd' })
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'freebsd'),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => '/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      const info = getInfo()
      expect(info.os).toBe('freebsd')
      expect(info.isWindows).toBe(false)
      expect(info.isMac).toBe(false)
      expect(info.isLinux).toBe(false)
      expect(info.pathSeparator).toBe('/')
    })
  })

  describe('getPlatformInfo for sunos', () => {
    it('returns sunos platform info', async () => {
      Object.defineProperty(process, 'platform', { value: 'sunos' })
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'sunos'),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => '/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      const info = getInfo()
      expect(info.os).toBe('sunos')
      expect(info.isWindows).toBe(false)
      expect(info.isMac).toBe(false)
      expect(info.isLinux).toBe(false)
    })
  })

  describe('getPlatformInfo for aix', () => {
    it('returns aix platform info', async () => {
      Object.defineProperty(process, 'platform', { value: 'aix' })
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'aix'),
        arch: jest.fn(() => 'ppc64'),
        tmpdir: jest.fn(() => '/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      const info = getInfo()
      expect(info.os).toBe('aix')
      expect(info.isWindows).toBe(false)
      expect(info.isMac).toBe(false)
      expect(info.isLinux).toBe(false)
    })
  })

  describe('getPlatformInfo for unknown platform', () => {
    it('returns other for unrecognized platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'haiku' })
      jest.doMock('node:os', () => ({
        platform: jest.fn(() => 'haiku' as NodeJS.Platform),
        arch: jest.fn(() => 'x64'),
        tmpdir: jest.fn(() => '/tmp'),
      }))
      const { getPlatformInfo: getInfo } = await import('./detect')
      const info = getInfo()
      expect(info.os).toBe('other')
      expect(info.isWindows).toBe(false)
      expect(info.isMac).toBe(false)
      expect(info.isLinux).toBe(false)
    })
  })
})
