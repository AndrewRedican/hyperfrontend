import type { FileContent, FileTree } from './write-tree'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, afterEach, before, beforeEach } from 'node:test'
import { within, writeFile, writeTree } from './write-tree'

/**
 * Where a temporary directory is created and what it starts with.
 */
export type TempDirOptions = {
  /** Start of the directory's name, before the random suffix. Defaults to `hf-test-`. */
  prefix?: string
  /** Directory to create it in. Defaults to the system temporary directory. */
  parent?: string
  /** Files written into it as soon as it is created. */
  tree?: FileTree
}

/**
 * When `useTempDir` creates and removes its directory.
 */
export interface UseTempDirOptions extends TempDirOptions {
  /** `each` gives every test a fresh directory; `all` shares one across the suite. Defaults to `each`. */
  scope?: 'each' | 'all'
}

/**
 * A temporary directory and the file operations a spec runs against it, every path relative
 * to the directory.
 */
export type TempDir = {
  /** Absolute path of the directory, with symbolic links resolved. */
  readonly path: string
  /** Joins segments onto the directory's path. */
  resolve(...segments: string[]): string
  /** Writes one file, creating its parent directories, and returns its absolute path. */
  write(relativePath: string, content: FileContent): string
  /** Writes a tree of files. */
  writeTree(tree: FileTree): void
  /** Reads a file as UTF-8 text. */
  read(relativePath: string): string
  /** Reads and parses a JSON file. */
  readJson<TValue = unknown>(relativePath: string): TValue
  /** Reports whether a file or directory exists. */
  exists(relativePath: string): boolean
  /** Creates a directory and any missing parents, and returns its absolute path. */
  mkdir(relativePath: string): string
  /** Deletes the directory and everything in it. Removing twice is a no-op. */
  remove(): void
}

/**
 * Builds the file operations over a directory path that is looked up on every call.
 *
 * @param pathOf - Returns the directory's current path.
 * @param remove - Deletes the directory.
 * @returns File operations that resolve every path against the directory current at the time of the call.
 */
function handleFor(pathOf: () => string, remove: () => void): TempDir {
  return {
    get path() {
      return pathOf()
    },
    resolve: (...segments) => join(pathOf(), ...segments),
    write: (relativePath, content) => writeFile(pathOf(), relativePath, content),
    writeTree: (tree) => writeTree(pathOf(), tree),
    read: (relativePath) => readFileSync(join(pathOf(), relativePath), 'utf8'),
    readJson: (relativePath) => JSON.parse(readFileSync(join(pathOf(), relativePath), 'utf8')),
    exists: (relativePath) => existsSync(join(pathOf(), relativePath)),
    mkdir: (relativePath) => {
      const target = within(pathOf(), relativePath)
      mkdirSync(target, { recursive: true })
      return target
    },
    remove,
  }
}

/**
 * Creates a directory and returns its resolved path.
 *
 * @param options - Name prefix, parent and initial files.
 * @returns The directory's real path.
 */
function makeDirectory(options: TempDirOptions): string {
  const parent = options.parent ?? tmpdir()
  mkdirSync(parent, { recursive: true })
  // why: the system temporary directory is a symbolic link on macOS and may be an 8.3 short name on Windows, and a path that differs from what `process.cwd()` or `realpath` report makes path assertions fail for reasons unrelated to the code under test.
  const path = realpathSync.native(mkdtempSync(join(parent, options.prefix ?? 'hf-test-')))
  if (options.tree) writeTree(path, options.tree)
  return path
}

/**
 * Deletes a directory tree, retrying while Windows still holds a handle open in it.
 *
 * @param path - The directory to delete.
 */
function removeDirectory(path: string): void {
  rmSync(path, { recursive: true, force: true, maxRetries: 3 })
}

/**
 * Creates a temporary directory now, for the caller to remove.
 *
 * Use it inside a single test, removing it in the test's own cleanup, or at module scope
 * with a matching `after`. For a directory every test in a suite gets, `useTempDir`
 * registers the hooks itself.
 *
 * @param options - Name prefix, parent and initial files.
 * @returns The directory and its file operations.
 * @example A directory one test owns
 * ```ts
 * it('reads the manifest', (t) => {
 *   const dir = createTempDir({ tree: { 'package.json': { name: 'app' } } })
 *   t.after(() => dir.remove())
 *   expect(readManifest(dir.path).name).toBe('app')
 * })
 * ```
 */
export function createTempDir(options: TempDirOptions = {}): TempDir {
  const path = makeDirectory(options)
  return handleFor(
    () => path,
    () => removeDirectory(path)
  )
}

/**
 * Gives every test in the enclosing suite a temporary directory, created before and deleted
 * after, by registering the `node:test` hooks that do it.
 *
 * Call it in a `describe` body or at the top of a spec file. The returned handle reads the
 * directory current at the time of each call, so it can be captured once and used from any
 * test or hook. Reading it outside a test throws, since no directory exists then.
 *
 * @param options - Name prefix, parent, initial files, and whether tests share one directory.
 * @returns A handle to the current directory and its file operations.
 * @example A fresh directory for every test
 * ```ts
 * describe('loadConfig', () => {
 *   const dir = useTempDir({ tree: { 'package.json': {} } })
 *
 *   it('finds a config file beside the manifest', () => {
 *     dir.write('hf.config.json', { strict: true })
 *     expect(loadConfig(dir.path)).toEqual({ strict: true })
 *   })
 * })
 * ```
 */
export function useTempDir(options: UseTempDirOptions = {}): TempDir {
  let current: string | undefined
  const pathOf = (): string => {
    if (current === undefined) throw new Error('useTempDir: the directory exists only while a test or hook of the suite runs')
    return current
  }
  const remove = (): void => {
    if (current !== undefined) removeDirectory(current)
    current = undefined
  }
  const [setUp, tearDown] = options.scope === 'all' ? [before, after] : [beforeEach, afterEach]
  setUp(() => {
    current = makeDirectory(options)
  })
  tearDown(remove)
  return handleFor(pathOf, remove)
}
