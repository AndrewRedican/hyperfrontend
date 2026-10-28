/**
 * The virtual file tree a generator works on, and the JSON helpers over it: the structural
 * subset every tree the generators are handed satisfies, whether Nx's, the compat declaration's
 * or the owned virtual filesystem's.
 *
 * @module lib/tree/tree
 */

import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** One change a tree has recorded since it was opened. */
export interface TreeChange {
  /** The path, relative to the tree's root, POSIX. */
  readonly path: string
  /** What happened to the file. */
  readonly type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** The content written, or nothing for a deletion. */
  readonly content?: Buffer | null
}

/** A virtual file tree: reads fall through to the files, writes are recorded until committed. */
export interface Tree {
  /** The directory every path is relative to, absolute. */
  readonly root: string
  /** The content of a file, or null when there is none. */
  read(path: string): Buffer | null
  /** The text of a file, or null when there is none. */
  read(path: string, encoding: 'utf-8'): string | null
  /** Records a file's content. */
  write(path: string, content: Buffer | string): void
  /** Whether a file or directory is there. */
  exists(path: string): boolean
  /** Records a file's deletion. */
  delete(path: string): void
  /** Whether the path names a file. */
  isFile(path: string): boolean
  /** The names directly under a directory. */
  children(path: string): string[]
  /** Every change recorded so far. */
  listChanges(): TreeChange[]
}

/**
 * The value of a JSON file of the tree.
 *
 * @param tree - The tree the file is read from
 * @param path - The file, relative to the root
 * @returns The parsed value
 * @throws {Error} When the file is missing or does not parse
 */
export function readJson<Value>(tree: Tree, path: string): Value {
  const text = tree.read(path, 'utf-8')
  if (text === null) throw createError(`Cannot find ${path}`)
  try {
    return parse(text) as Value
  } catch (error) {
    throw createError(`Cannot parse ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Writes a value as two-space JSON with a trailing newline.
 *
 * @param tree - The tree the file is written to
 * @param path - The file, relative to the root
 * @param value - What to write
 */
export function writeJson(tree: Tree, path: string, value: unknown): void {
  tree.write(path, `${stringify(value, null, 2)}\n`)
}

/**
 * Rewrites a JSON file through an updater.
 *
 * @param tree - The tree the file lives in
 * @param path - The file, relative to the root
 * @param updater - Maps the current value to the one written
 */
export function updateJson<Value>(tree: Tree, path: string, updater: (value: Value) => Value): void {
  writeJson(tree, path, updater(readJson<Value>(tree, path)))
}
