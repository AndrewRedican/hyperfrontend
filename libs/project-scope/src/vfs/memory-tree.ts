import type { TreeStore } from './store'
import type { CreateTreeOptions, Tree } from './types'
import { posix } from 'node:path'
import { from as arrayFrom } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { isAbsolute, removeTrailingSlash, resolvePath } from '../core/path'
import { createStoreTree } from './fs-tree'

/**
 * The files a memory tree starts with, keyed by path relative to its root.
 */
export type MemoryTreeFiles = Record<string, string | Buffer>

/**
 * Options for a tree held entirely in memory.
 */
export interface MemoryTreeOptions extends Pick<CreateTreeOptions, 'verbose'> {
  /** Absolute path the tree reports as its root and resolves absolute paths against. Defaults to `/workspace`. */
  root?: string
}

/**
 * Builds a store over a fixed set of files, with directories implied by the paths under them.
 *
 * @param root - The tree's resolved root, which always reads as a directory.
 * @param files - File contents keyed by resolved absolute path.
 * @returns A read-only store that never reports a symbolic link.
 *
 * @example A store with one file
 * ```typescript
 * const store = createMemoryStore('/workspace', createMap([['/workspace/a.txt', Buffer.from('a')]]))
 * store.list('/workspace') // ['a.txt']
 * ```
 */
export function createMemoryStore(root: string, files: Map<string, Buffer>): TreeStore {
  const below = (absolutePath: string): string[] => {
    const prefix = `${removeTrailingSlash(absolutePath)}${posix.sep}`
    return arrayFrom(files.keys())
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length))
  }
  const isDirectory = (absolutePath: string): boolean => absolutePath === root || below(absolutePath).length > 0
  return {
    exists: (absolutePath) => files.has(absolutePath) || isDirectory(absolutePath),
    isFile: (absolutePath) => files.has(absolutePath),
    isDirectory,
    read: (absolutePath) => files.get(absolutePath) ?? null,
    list: (absolutePath) => arrayFrom(createSet(below(absolutePath).map((path) => path.split(posix.sep)[0] as string))),
    isSymlink: () => false,
    readlink: (absolutePath) => {
      throw createError(`A memory tree holds no symbolic links: ${absolutePath}`)
    },
  }
}

/**
 * Create a tree whose files live only in memory, for code that reads and writes through a
 * `Tree` without touching a disk.
 *
 * The starting files are the tree's base layer: they read as existing files and are not
 * reported by `listChanges`, while everything written, renamed or deleted afterwards is
 * buffered and reported exactly as a disk-backed tree reports it. Directories exist wherever
 * a file path implies them. Paths are portable, so a native Windows path and its POSIX
 * spelling name the same file.
 *
 * @param files - The files the tree starts with, keyed by path relative to the root
 * @param options - The root to report, and verbose logging
 * @returns A Tree over the given files
 *
 * @example Testing a version bump without a workspace on disk
 * ```typescript
 * import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
 *
 * const tree = createMemoryTree({ 'packages/app/package.json': '{"version":"1.0.0"}' })
 * bumpVersion(tree, 'packages/app', '1.1.0')
 * tree.listChanges().map((change) => change.path) // ['packages/app/package.json']
 * ```
 */
export function createMemoryTree(files: MemoryTreeFiles = {}, options: MemoryTreeOptions = {}): Tree {
  const root = resolvePath(options.root ?? '/workspace')
  const contents = createMap<string, Buffer>()
  for (const [path, content] of entries(files)) {
    contents.set(
      isAbsolute(path) ? resolvePath(path) : resolvePath(root, path),
      typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
    )
  }
  return createStoreTree(root, createMemoryStore(root, contents), { verbose: options.verbose })
}
