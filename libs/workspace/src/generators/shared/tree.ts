/**
 * The virtual file tree a generator works on, as the workspace's contract declares it, and the
 * JSON helpers over it.
 *
 * @module generators/shared/tree
 */

import type { Tree } from '../../runner/contract'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * The value of a JSON file of the tree.
 *
 * @param tree - The tree the file is read from
 * @param path - The file, relative to the root
 * @returns The parsed value
 * @throws {Error} When the file is missing or does not parse
 *
 * @example Reading a manifest the tree holds
 * ```typescript
 * import { readJson } from '@hyperfrontend/workspace/generators'
 *
 * readJson<{ name: string; version: string }>(tree, 'libs/core/package.json') // => { name: '@acme/core', version: '1.0.0' }
 * readJson(tree, 'libs/core/missing.json') // throws: Cannot find libs/core/missing.json
 * ```
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
 *
 * @example A new project's manifest
 * ```typescript
 * writeJson(tree, 'libs/core/project.json', { name: 'lib-core', projectType: 'library', targets: { build: {} } })
 * tree.read('libs/core/project.json', 'utf-8') // => '{\n  "name": "lib-core",\n  "projectType": "library",\n  "targets": {\n    "build": {}\n  }\n}\n'
 * ```
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
 *
 * @example Adding a target to an existing project
 * ```typescript
 * import type { ProjectConfiguration } from '@hyperfrontend/workspace/generators'
 * import { updateJson } from '@hyperfrontend/workspace/generators'
 *
 * updateJson<ProjectConfiguration>(tree, 'libs/core/project.json', (json) => {
 *   json.targets = { ...json.targets, docs: { command: 'typedoc' } }
 *   return json
 * })
 * ```
 */
export function updateJson<Value>(tree: Tree, path: string, updater: (value: Value) => Value): void {
  writeJson(tree, path, updater(readJson<Value>(tree, path)))
}

export type { Tree, TreeChange } from '../../runner/contract'
