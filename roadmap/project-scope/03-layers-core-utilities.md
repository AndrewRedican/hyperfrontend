# Layer 1: Core Utilities

> **Document**: 03-layers-core-utilities.md
> **Library**: `@hyperfrontend/project-scope`
> **Layer**: Internal Foundation

---

## Overview

Layer 1 provides the foundational utilities that all other layers depend on. These utilities are **purely internal** and handle low-level concerns:

- File system synchronous operations
- Path manipulation and normalization
- Buffer and encoding handling
- Cross-platform compatibility

---

## Design Principles

1. **Zero External Dependencies**: Use only Node.js built-in modules
2. **Synchronous Only**: All operations are synchronous per ESLint rule
3. **Platform Agnostic**: Handle OS differences transparently
4. **Defensive Programming**: Validate inputs, handle edge cases

---

## Module: `core/fs`

### File System Primitives

```typescript
// core/fs/index.ts
export { readFileContent, readFileBuffer } from './read'
export { writeFileContent, writeFileBuffer, ensureDir } from './write'
export { getFileStat, isFile, isDirectory, isSymlink } from './stat'
export { readDirectory, readDirectoryRecursive } from './directory'
export { getFileMode, setFileMode, isReadable, isWritable } from './permissions'
```

### Read Operations

```typescript
// core/fs/read.ts
import { readFileSync, existsSync } from 'node:fs'
import { Logger } from '../../logging'

/**
 * Read file contents as string.
 * @throws FileSystemError if file doesn't exist or can't be read
 */
export function readFileContent(filePath: string, encoding: BufferEncoding = 'utf-8', logger?: Logger): string {
  logger?.debug(`Reading file: ${filePath}`)

  if (!existsSync(filePath)) {
    throw new FileSystemError(`File not found: ${filePath}`, 'FS_NOT_FOUND', { path: filePath, operation: 'read' })
  }

  try {
    return readFileSync(filePath, { encoding })
  } catch (error) {
    throw new FileSystemError(`Failed to read file: ${filePath}`, 'FS_READ_ERROR', { path: filePath, operation: 'read', cause: error })
  }
}

/**
 * Read file contents as Buffer.
 */
export function readFileBuffer(filePath: string, logger?: Logger): Buffer {
  logger?.debug(`Reading file as buffer: ${filePath}`)

  if (!existsSync(filePath)) {
    throw new FileSystemError(`File not found: ${filePath}`, 'FS_NOT_FOUND', { path: filePath, operation: 'read' })
  }

  try {
    return readFileSync(filePath)
  } catch (error) {
    throw new FileSystemError(`Failed to read file: ${filePath}`, 'FS_READ_ERROR', { path: filePath, operation: 'read', cause: error })
  }
}

/**
 * Read file if exists, return null otherwise.
 */
export function readFileIfExists(filePath: string, encoding: BufferEncoding = 'utf-8'): string | null {
  if (!existsSync(filePath)) {
    return null
  }
  try {
    return readFileSync(filePath, { encoding })
  } catch {
    return null
  }
}
```

### Write Operations

```typescript
// core/fs/write.ts
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Write string content to file.
 * Creates parent directories if needed.
 */
export function writeFileContent(filePath: string, content: string, options?: WriteFileOptions, logger?: Logger): void {
  logger?.debug(`Writing file: ${filePath}`)

  ensureDir(dirname(filePath))

  try {
    writeFileSync(filePath, content, {
      encoding: options?.encoding ?? 'utf-8',
      mode: options?.mode,
    })
  } catch (error) {
    throw new FileSystemError(`Failed to write file: ${filePath}`, 'FS_WRITE_ERROR', { path: filePath, operation: 'write', cause: error })
  }
}

/**
 * Write Buffer to file.
 */
export function writeFileBuffer(filePath: string, content: Buffer, options?: WriteFileOptions, logger?: Logger): void {
  logger?.debug(`Writing file as buffer: ${filePath}`)

  ensureDir(dirname(filePath))

  try {
    writeFileSync(filePath, content, { mode: options?.mode })
  } catch (error) {
    throw new FileSystemError(`Failed to write file: ${filePath}`, 'FS_WRITE_ERROR', { path: filePath, operation: 'write', cause: error })
  }
}

/**
 * Ensure directory exists, create recursively if not.
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Write file options.
 */
export interface WriteFileOptions {
  encoding?: BufferEncoding
  mode?: number
}
```

### Stat Operations

```typescript
// core/fs/stat.ts
import { statSync, lstatSync, existsSync } from 'node:fs'

/**
 * Get file stats with error handling.
 * @param followSymlinks If true, use stat; if false, use lstat
 */
export function getFileStat(filePath: string, followSymlinks: boolean = true): FileStats | null {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const stat = followSymlinks ? statSync(filePath) : lstatSync(filePath)
    return {
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymlink: stat.isSymbolicLink(),
      size: stat.size,
      created: stat.birthtime,
      modified: stat.mtime,
      accessed: stat.atime,
      mode: stat.mode,
    }
  } catch {
    return null
  }
}

/**
 * Check if path is a file.
 */
export function isFile(filePath: string): boolean {
  const stats = getFileStat(filePath)
  return stats?.isFile ?? false
}

/**
 * Check if path is a directory.
 */
export function isDirectory(dirPath: string): boolean {
  const stats = getFileStat(dirPath)
  return stats?.isDirectory ?? false
}

/**
 * Check if path is a symbolic link.
 */
export function isSymlink(linkPath: string): boolean {
  const stats = getFileStat(linkPath, false)
  return stats?.isSymlink ?? false
}

/**
 * File statistics.
 */
export interface FileStats {
  isFile: boolean
  isDirectory: boolean
  isSymlink: boolean
  size: number
  created: Date
  modified: Date
  accessed: Date
  mode: number
}
```

### Directory Operations

```typescript
// core/fs/directory.ts
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { isDirectory, isFile, isSymlink } from './stat'

/**
 * Read directory contents.
 */
export function readDirectory(dirPath: string): DirectoryEntry[] {
  if (!existsSync(dirPath)) {
    throw new FileSystemError(`Directory not found: ${dirPath}`, 'FS_NOT_FOUND', { path: dirPath, operation: 'readdir' })
  }

  if (!isDirectory(dirPath)) {
    throw new FileSystemError(`Not a directory: ${dirPath}`, 'FS_NOT_A_DIRECTORY', { path: dirPath })
  }

  const entries = readdirSync(dirPath, { withFileTypes: true })

  return entries.map((entry) => ({
    name: entry.name,
    path: join(dirPath, entry.name),
    isFile: entry.isFile(),
    isDirectory: entry.isDirectory(),
    isSymlink: entry.isSymbolicLink(),
  }))
}

/**
 * Read directory recursively with depth control.
 */
export function readDirectoryRecursive(dirPath: string, options?: RecursiveOptions): DirectoryEntry[] {
  const maxDepth = options?.maxDepth ?? Infinity
  const includeHidden = options?.includeHidden ?? false
  const followSymlinks = options?.followSymlinks ?? false

  const results: DirectoryEntry[] = []

  function walk(currentPath: string, depth: number): void {
    if (depth > maxDepth) return

    const entries = readDirectory(currentPath)

    for (const entry of entries) {
      // Skip hidden files/dirs if not included
      if (!includeHidden && entry.name.startsWith('.')) {
        continue
      }

      results.push({ ...entry, depth })

      // Recurse into directories
      if (entry.isDirectory || (entry.isSymlink && followSymlinks)) {
        try {
          walk(entry.path, depth + 1)
        } catch {
          // Skip inaccessible directories
        }
      }
    }
  }

  walk(dirPath, 0)
  return results
}

/**
 * Directory entry.
 */
export interface DirectoryEntry {
  name: string
  path: string
  isFile: boolean
  isDirectory: boolean
  isSymlink: boolean
  depth?: number
}

/**
 * Recursive read options.
 */
export interface RecursiveOptions {
  maxDepth?: number
  includeHidden?: boolean
  followSymlinks?: boolean
}
```

---

## Module: `core/path`

### Path Manipulation

```typescript
// core/path/index.ts
export { normalizePath, normalizeToForwardSlashes } from './normalize'
export { resolvePath, resolveFromWorkspace } from './resolve'
export { relativePath, offsetFromRoot } from './relative'
export { pathSegments, getBasename, getDirname, getExtension } from './segments'
```

### Path Normalization

```typescript
// core/path/normalize.ts
import { normalize, sep } from 'node:path'

/**
 * Normalize path for current platform.
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return ''
  return normalize(filePath)
}

/**
 * Normalize path using forward slashes (POSIX style).
 * Useful for configuration files and cross-platform consistency.
 */
export function normalizeToForwardSlashes(filePath: string): string {
  if (!filePath) return ''
  return normalize(filePath).split(sep).join('/')
}

/**
 * Normalize to native path separator.
 */
export function normalizeToNative(filePath: string): string {
  if (!filePath) return ''
  return normalize(filePath.replace(/[/\\]/g, sep))
}

/**
 * Remove trailing slashes.
 */
export function removeTrailingSlash(filePath: string): string {
  return filePath.replace(/[/\\]+$/, '')
}

/**
 * Ensure trailing slash.
 */
export function ensureTrailingSlash(filePath: string): string {
  const normalized = removeTrailingSlash(filePath)
  return normalized + '/'
}
```

### Path Resolution

```typescript
// core/path/resolve.ts
import { resolve, isAbsolute } from 'node:path'
import { realpathSync, existsSync } from 'node:fs'

/**
 * Resolve path to absolute.
 */
export function resolvePath(...segments: string[]): string {
  return resolve(...segments)
}

/**
 * Resolve path relative to workspace root.
 */
export function resolveFromWorkspace(workspaceRoot: string, ...segments: string[]): string {
  return resolve(workspaceRoot, ...segments)
}

/**
 * Resolve symlinks to real path.
 */
export function resolveRealPath(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null
  }
  try {
    return realpathSync(filePath)
  } catch {
    return null
  }
}

/**
 * Check if path is absolute.
 */
export function isAbsolutePath(filePath: string): boolean {
  return isAbsolute(filePath)
}
```

### Relative Paths

```typescript
// core/path/relative.ts
import { relative, sep } from 'node:path'
import { normalizeToForwardSlashes } from './normalize'

/**
 * Get relative path from one location to another.
 */
export function relativePath(from: string, to: string): string {
  return relative(from, to)
}

/**
 * Calculate offset from root (e.g., "../../../").
 */
export function offsetFromRoot(filePath: string): string {
  const segments = normalizeToForwardSlashes(filePath).split('/').filter(Boolean)

  if (segments.length === 0) return ''

  return segments.map(() => '..').join('/') + '/'
}
```

### Path Segments

```typescript
// core/path/segments.ts
import { basename, dirname, extname, parse } from 'node:path'

/**
 * Split path into segments.
 */
export function pathSegments(filePath: string): string[] {
  return filePath.split(/[/\\]/).filter(Boolean)
}

/**
 * Get basename (filename with extension).
 */
export function getBasename(filePath: string): string {
  return basename(filePath)
}

/**
 * Get directory name.
 */
export function getDirname(filePath: string): string {
  return dirname(filePath)
}

/**
 * Get file extension (including dot).
 */
export function getExtension(filePath: string): string {
  return extname(filePath)
}

/**
 * Get filename without extension.
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const parsed = parse(filePath)
  return parsed.name
}

/**
 * Parse path into components.
 */
export function parsePath(filePath: string): ParsedPath {
  const parsed = parse(filePath)
  return {
    root: parsed.root,
    dir: parsed.dir,
    base: parsed.base,
    name: parsed.name,
    ext: parsed.ext,
  }
}

export interface ParsedPath {
  root: string
  dir: string
  base: string
  name: string
  ext: string
}
```

---

## Module: `core/encoding`

### Encoding Detection and Conversion

```typescript
// core/encoding/index.ts
export { detectEncoding, isTextFile, isBinaryFile } from './detect'
export { convertEncoding, normalizeLineEndings } from './convert'
```

### Encoding Detection

```typescript
// core/encoding/detect.ts

/**
 * Common binary file signatures.
 */
const BINARY_SIGNATURES: Array<{ signature: Buffer; description: string }> = [
  { signature: Buffer.from([0x89, 0x50, 0x4e, 0x47]), description: 'PNG' },
  { signature: Buffer.from([0xff, 0xd8, 0xff]), description: 'JPEG' },
  { signature: Buffer.from([0x47, 0x49, 0x46, 0x38]), description: 'GIF' },
  { signature: Buffer.from([0x50, 0x4b, 0x03, 0x04]), description: 'ZIP' },
  { signature: Buffer.from([0x1f, 0x8b]), description: 'GZIP' },
  // ... more signatures
]

/**
 * Detect if content is likely text or binary.
 */
export function detectEncoding(content: Buffer): EncodingInfo {
  // Check for BOM
  if (content.length >= 3) {
    if (content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
      return { type: 'text', encoding: 'utf-8', hasBom: true }
    }
  }
  if (content.length >= 2) {
    if (content[0] === 0xfe && content[1] === 0xff) {
      return { type: 'text', encoding: 'utf-16be', hasBom: true }
    }
    if (content[0] === 0xff && content[1] === 0xfe) {
      return { type: 'text', encoding: 'utf-16le', hasBom: true }
    }
  }

  // Check for binary signatures
  for (const { signature, description } of BINARY_SIGNATURES) {
    if (content.length >= signature.length) {
      if (content.subarray(0, signature.length).equals(signature)) {
        return { type: 'binary', format: description }
      }
    }
  }

  // Check for null bytes (usually indicates binary)
  const sampleSize = Math.min(content.length, 8000)
  for (let i = 0; i < sampleSize; i++) {
    if (content[i] === 0) {
      return { type: 'binary' }
    }
  }

  return { type: 'text', encoding: 'utf-8', hasBom: false }
}

/**
 * Check if buffer represents text content.
 */
export function isTextFile(content: Buffer): boolean {
  return detectEncoding(content).type === 'text'
}

/**
 * Check if buffer represents binary content.
 */
export function isBinaryFile(content: Buffer): boolean {
  return detectEncoding(content).type === 'binary'
}

/**
 * Encoding detection result.
 */
export type EncodingInfo = { type: 'text'; encoding: BufferEncoding; hasBom: boolean } | { type: 'binary'; format?: string }
```

### Encoding Conversion

```typescript
// core/encoding/convert.ts

/**
 * Convert buffer to string with encoding detection.
 */
export function bufferToString(content: Buffer, encoding?: BufferEncoding): string {
  if (encoding) {
    return content.toString(encoding)
  }

  // Auto-detect and convert
  const info = detectEncoding(content)
  if (info.type === 'text') {
    // Remove BOM if present
    let offset = 0
    if (info.hasBom) {
      offset = info.encoding === 'utf-8' ? 3 : 2
    }
    return content.subarray(offset).toString(info.encoding)
  }

  throw new Error('Cannot convert binary content to string')
}

/**
 * Normalize line endings to specified style.
 */
export function normalizeLineEndings(content: string, style: 'lf' | 'crlf' | 'auto' = 'auto'): string {
  if (style === 'auto') {
    // Detect platform default
    style = process.platform === 'win32' ? 'crlf' : 'lf'
  }

  // First normalize to LF
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Then convert to target style
  if (style === 'crlf') {
    return normalized.replace(/\n/g, '\r\n')
  }

  return normalized
}

/**
 * Detect line ending style in content.
 */
export function detectLineEndings(content: string): 'lf' | 'crlf' | 'mixed' | 'none' {
  const hasCRLF = content.includes('\r\n')
  const hasLFOnly = /[^\r]\n/.test(content) || content.startsWith('\n')

  if (hasCRLF && hasLFOnly) return 'mixed'
  if (hasCRLF) return 'crlf'
  if (hasLFOnly) return 'lf'
  return 'none'
}
```

---

## Module: `core/platform`

### Platform Detection and Compatibility

```typescript
// core/platform/index.ts
export { getPlatformInfo, isWindows, isMac, isLinux, detectPlatform } from './detect'
export { getLineEnding, getPathSeparator, detectCaseSensitivity } from './case-sensitivity'
```

### Platform Detection

```typescript
// core/platform/detect.ts

/**
 * Cached platform info (computed once).
 */
let cachedPlatformInfo: PlatformInfo | null = null

/**
 * Get comprehensive platform information.
 */
export function getPlatformInfo(): PlatformInfo {
  if (cachedPlatformInfo) {
    return cachedPlatformInfo
  }

  const platform = process.platform as NodeJS.Platform

  cachedPlatformInfo = {
    os: platform as PlatformInfo['os'],
    arch: process.arch as PlatformInfo['arch'],
    nodeVersion: process.versions.node,
    isWindows: platform === 'win32',
    isMac: platform === 'darwin',
    isLinux: platform === 'linux',
    caseSensitive: detectCaseSensitivity(),
    pathSeparator: platform === 'win32' ? '\\' : '/',
    lineEnding: platform === 'win32' ? '\r\n' : '\n',
  }

  return cachedPlatformInfo
}

/**
 * Check if running on Windows.
 */
export function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * Check if running on macOS.
 */
export function isMac(): boolean {
  return process.platform === 'darwin'
}

/**
 * Check if running on Linux.
 */
export function isLinux(): boolean {
  return process.platform === 'linux'
}

/**
 * Platform information.
 */
export interface PlatformInfo {
  os: 'darwin' | 'linux' | 'win32' | 'freebsd' | 'sunos' | 'aix'
  arch: 'x64' | 'arm64' | 'arm' | 'ia32' | 's390x' | 'ppc64'
  nodeVersion: string
  isWindows: boolean
  isMac: boolean
  isLinux: boolean
  caseSensitive: boolean
  pathSeparator: '/' | '\\'
  lineEnding: '\n' | '\r\n'
}
```

### Case Sensitivity Detection

```typescript
// core/platform/case-sensitivity.ts
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Cached case sensitivity result.
 */
let cachedCaseSensitive: boolean | null = null

/**
 * Detect if file system is case sensitive.
 */
export function detectCaseSensitivity(): boolean {
  if (cachedCaseSensitive !== null) {
    return cachedCaseSensitive
  }

  // Quick check based on platform
  if (process.platform === 'win32') {
    cachedCaseSensitive = false
    return false
  }

  // Test actual file system behavior
  const testDir = tmpdir()
  const testFile = join(testDir, `case_test_${Date.now()}_A`)
  const testFileUpper = join(testDir, `case_test_${Date.now()}_a`)

  try {
    writeFileSync(testFile, '')
    cachedCaseSensitive = !existsSync(testFileUpper)
    unlinkSync(testFile)
  } catch {
    // Default to case insensitive on error
    cachedCaseSensitive = false
  }

  return cachedCaseSensitive
}

/**
 * Get platform-appropriate line ending.
 */
export function getLineEnding(): '\n' | '\r\n' {
  return process.platform === 'win32' ? '\r\n' : '\n'
}

/**
 * Get platform-appropriate path separator.
 */
export function getPathSeparator(): '/' | '\\' {
  return process.platform === 'win32' ? '\\' : '/'
}

/**
 * Compare paths with case sensitivity awareness.
 */
export function pathsEqual(path1: string, path2: string): boolean {
  const caseSensitive = detectCaseSensitivity()
  if (caseSensitive) {
    return path1 === path2
  }
  return path1.toLowerCase() === path2.toLowerCase()
}
```

---

## Internal Dependencies

This layer uses **no internal @hyperfrontend dependencies**. It relies solely on:

- `node:fs` - File system operations
- `node:path` - Path manipulation
- `node:os` - OS utilities

---

## Testing Strategy

### Unit Test Coverage

Each function should have tests covering:

1. **Happy Path**: Normal operation
2. **Edge Cases**: Empty inputs, special characters
3. **Error Cases**: Missing files, permission errors
4. **Platform Differences**: Path separators, case sensitivity

### Example Test Structure

```typescript
// core/fs/read.spec.ts
describe('readFileContent', () => {
  it('should read file content as string', () => {
    // Test implementation
  })

  it('should throw FileSystemError for missing file', () => {
    // Test implementation
  })

  it('should handle different encodings', () => {
    // Test implementation
  })
})

// core/platform/detect.spec.ts
describe('getPlatformInfo', () => {
  it('should return consistent platform info', () => {
    const info1 = getPlatformInfo()
    const info2 = getPlatformInfo()
    expect(info1).toBe(info2) // Same cached instance
  })

  it('should detect correct platform', () => {
    const info = getPlatformInfo()
    expect(['darwin', 'linux', 'win32']).toContain(info.os)
  })
})
```

---

## Related Documents

- [Architecture](./01-architecture.md)
- [API Design](./02-api-design.md)
- [Layer 2: Project Utilities](./04-layers-project-utilities.md)
