import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { exists, isDirectory, isFile, readDirectory } from '../core/fs'

/**
 * Where a tree reads the files it has not changed: the base layer under its buffered changes.
 *
 * Every path handed to a store is absolute and already normalized and confined to the tree's root.
 */
export interface TreeStore {
  /** Reports whether a file or directory exists. */
  exists(absolutePath: string): boolean
  /** Reports whether a regular file exists. */
  isFile(absolutePath: string): boolean
  /** Reports whether a directory exists. */
  isDirectory(absolutePath: string): boolean
  /** Reads a file's bytes, or null when it is not a readable file. */
  read(absolutePath: string): Buffer | null
  /** Lists the names of a directory's entries, or none when it cannot be read. */
  list(absolutePath: string): string[]
  /** Reports whether a path is a symbolic link. */
  isSymlink(absolutePath: string): boolean
  /** Reads where a symbolic link points. */
  readlink(absolutePath: string): string
}

/**
 * The store over the real file system, which `createFsTree` reads through.
 */
export const diskStore: TreeStore = {
  exists,
  isFile,
  isDirectory,
  read: (absolutePath) => {
    if (!isFile(absolutePath)) return null
    try {
      return readFileSync(absolutePath)
    } catch {
      return null
    }
  },
  list: (absolutePath) => {
    try {
      return readDirectory(absolutePath).map((entry) => entry.name)
    } catch {
      return []
    }
  },
  isSymlink: (absolutePath) => {
    try {
      return lstatSync(absolutePath).isSymbolicLink()
    } catch {
      return false
    }
  },
  readlink: (absolutePath) => readlinkSync(absolutePath),
}
