/**
 * A JSON file read as a value, or nothing: the one reader every module of the package shares, kept
 * apart from project discovery so that an executor reading a manifest does not import the
 * discovery of the workspace along with it.
 *
 * @module graph/json
 */

import { existsSync, readFileSync } from 'node:fs'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** The byte order mark some editors save in front of a file, which is no part of its JSON. */
const BYTE_ORDER_MARK = '\uFEFF'

/**
 * Parses the text of a JSON file, whichever revision it was read from. A byte order mark in front
 * of the text is dropped first, since the parser refuses it and the file would read as malformed.
 *
 * @param text - The file's text
 * @returns The value
 * @throws {SyntaxError} When the text is not JSON
 *
 * @example A file saved with a byte order mark reads as the same value
 * ```typescript
 * parseJsonText<{ name: string }>('\uFEFF{ "name": "hyperfrontend" }') // => { name: 'hyperfrontend' }
 * parseJsonText<{ name: string }>('{ "name": "hyperfrontend" }') // => { name: 'hyperfrontend' }
 * parseJsonText('{ "name": ') // throws a SyntaxError
 * ```
 */
export function parseJsonText<Value>(text: string): Value {
  return parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text) as Value
}

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
 *
 * @example A file saved with a byte order mark reads as its value
 * ```typescript
 * // hf.json saved by an editor that writes the mark
 * readJson<{ namedInputs?: object }>(join(root, 'hf.json'))?.namedInputs // => { default: [...], production: [...] }
 * ```
 */
export function readJson<Value>(path: string): Value | null {
  if (!existsSync(path)) return null
  try {
    return parseJsonText<Value>(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}
