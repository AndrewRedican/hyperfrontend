/**
 * The virtual file tree a generator works on, as the workspace's contract declares it, and the
 * JSON helpers over it.
 *
 * @module lib/tree/tree
 */

import type { Tree } from '@hyperfrontend/workspace/runner'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

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

export type { Tree, TreeChange } from '@hyperfrontend/workspace'
