import { writeFileSync, unlinkSync, existsSync, mkdtempSync, rmdirSync } from 'node:fs'
import { platform, arch, tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Platform information.
 */
export interface PlatformInfo {
  /** Operating system */
  os: 'darwin' | 'linux' | 'win32' | 'freebsd' | 'sunos' | 'aix' | 'other'
  /** CPU architecture */
  arch: string
  /** Node.js version */
  nodeVersion: string
  /** Is Windows */
  isWindows: boolean
  /** Is macOS */
  isMac: boolean
  /** Is Linux */
  isLinux: boolean
  /** File system case sensitivity */
  caseSensitive: boolean
  /** Path separator for platform */
  pathSeparator: '/' | '\\'
  /** Line ending for platform */
  lineEnding: '\n' | '\r\n'
}

/**
 * Cached platform info (computed once).
 */
let cachedPlatformInfo: PlatformInfo | null = null

/**
 * Cached case sensitivity result.
 */
let cachedCaseSensitive: boolean | null = null

/**
 * Detect if the file system holding the temporary directory is case sensitive, by writing a file
 * named `A` and looking for `a`. The answer is probed on every platform, since APFS and NTFS can be
 * configured either way; only when no file can be written does it fall back to the platform's
 * default, case-sensitive on Linux and insensitive elsewhere.
 *
 * @returns True if file system is case-sensitive
 *
 * @example Detecting case sensitivity
 * ```typescript
 * if (detectCaseSensitivity()) {
 *   // 'File.ts' and 'file.ts' are different files, as on most Linux file systems
 * } else {
 *   // treat them as the same file, as the Windows and macOS defaults do
 * }
 * ```
 */
export function detectCaseSensitivity(): boolean {
  if (cachedCaseSensitive !== null) {
    return cachedCaseSensitive
  }

  let secureTestDir: string | null = null
  try {
    secureTestDir = mkdtempSync(join(tmpdir(), 'case-sensitivity-test-'))
    const testFile = join(secureTestDir, 'A')
    const testFileLower = join(secureTestDir, 'a')

    writeFileSync(testFile, '')
    cachedCaseSensitive = !existsSync(testFileLower)
    unlinkSync(testFile)
  } catch {
    // why: APFS and NTFS can be either, so the platform is only the fallback when no file can be written: Linux file systems are usually case-sensitive, the macOS and Windows defaults are not
    cachedCaseSensitive = process.platform === 'linux'
  } finally {
    if (secureTestDir) {
      try {
        rmdirSync(secureTestDir)
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return cachedCaseSensitive
}

/**
 * Check if file system is case-sensitive.
 *
 * @returns True if file system is case-sensitive
 *
 * @example Checking case sensitivity
 * ```typescript
 * const caseSensitive = isCaseSensitiveFs()
 * // => usually true on Linux, false on a default Windows or macOS volume
 * ```
 */
export function isCaseSensitiveFs(): boolean {
  return detectCaseSensitivity()
}

/**
 * Get comprehensive platform information.
 *
 * @returns Platform information object (cached after first call)
 *
 * @example Getting platform information
 * ```typescript
 * const info = getPlatformInfo()
 * console.log(info.os)           // => 'linux'
 * console.log(info.pathSeparator) // => '/'
 * console.log(info.lineEnding)    // => '\n'
 * ```
 */
export function getPlatformInfo(): PlatformInfo {
  if (cachedPlatformInfo) {
    return cachedPlatformInfo
  }

  const os = platform()
  const archInfo = arch()

  let osName: PlatformInfo['os']
  switch (os) {
    case 'win32':
      osName = 'win32'
      break
    case 'darwin':
      osName = 'darwin'
      break
    case 'linux':
      osName = 'linux'
      break
    case 'freebsd':
      osName = 'freebsd'
      break
    case 'sunos':
      osName = 'sunos'
      break
    case 'aix':
      osName = 'aix'
      break
    default:
      osName = 'other'
  }

  cachedPlatformInfo = {
    os: osName,
    arch: archInfo,
    nodeVersion: process.versions.node,
    isWindows: osName === 'win32',
    isMac: osName === 'darwin',
    isLinux: osName === 'linux',
    caseSensitive: detectCaseSensitivity(),
    pathSeparator: osName === 'win32' ? '\\' : '/',
    lineEnding: osName === 'win32' ? '\r\n' : '\n',
  }

  return cachedPlatformInfo
}

/**
 * Detect current platform.
 *
 * @returns Platform information object
 *
 * @example Detecting current platform
 * ```typescript
 * const platform = detectPlatform()
 * if (platform.isWindows) {
 *   // Windows-specific handling
 * }
 * ```
 */
export function detectPlatform(): PlatformInfo {
  return getPlatformInfo()
}

/**
 * Check if running on Windows.
 *
 * @returns True if running on Windows
 *
 * @example Checking for Windows
 * ```typescript
 * if (isWindows()) {
 *   // Use Windows-specific paths or commands
 * }
 * ```
 */
export function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * Check if running on macOS.
 *
 * @returns True if running on macOS
 *
 * @example Checking for macOS
 * ```typescript
 * if (isMac()) {
 *   // Use macOS-specific behavior
 * }
 * ```
 */
export function isMac(): boolean {
  return process.platform === 'darwin'
}

/**
 * Check if running on Linux.
 *
 * @returns True if running on Linux
 *
 * @example Checking for Linux
 * ```typescript
 * if (isLinux()) {
 *   // Use Linux-specific behavior
 * }
 * ```
 */
export function isLinux(): boolean {
  return process.platform === 'linux'
}
