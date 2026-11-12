/**
 * A JSON file read as a value, or nothing: the one reader every module of the package shares, kept
 * apart from project discovery so that an executor reading a manifest does not import the
 * discovery of the workspace along with it.
 *
 * @module graph/json
 */

import { existsSync, readFileSync } from 'node:fs'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Reads a JSON file, or nothing when it does not exist or does not parse.
 *
 * @param path - The file's absolute path
 * @returns The value, or null
 *
 * @example A missing or malformed file reads as null rather than throwing
 * ```typescript
 * readJson<{ name?: string }>(join(root, 'package.json'))?.name // => 'hyperfrontend'
 * readJson(join(root, 'absent.json')) // => null
 * readJson(join(root, 'broken.json')) // => null, for a file holding `{ "name": `
 * ```
 */
export function readJson<Value>(path: string): Value | null {
  if (!existsSync(path)) return null
  try {
    return parse(readFileSync(path, 'utf8')) as Value
  } catch {
    return null
  }
}
