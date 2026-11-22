/**
 * The property a JSON reader acts on when an object writes one key more than once: the last.
 *
 * @module rules/workspace/shared/last-property
 */

import type { JsonObjectNode, JsonPropertyNode } from '@hyperfrontend/json-utils'

/**
 * A property of an object by name, as `JSON.parse` reads it.
 *
 * @param object - The node whose properties are searched
 * @param name - The key to look for
 * @returns The last property with that name, or null
 *
 * @example A named input written twice in `hf.json` is read as its last list
 * ```typescript
 * // "namedInputs": { "engine": ["{projectRoot}/src/runner/**"], "engine": ["{projectRoot}/src/cli/**"] }
 * lastPropertyOf(namedInputs, 'engine')?.value // => the node of ["{projectRoot}/src/cli/**"]
 * lastPropertyOf(namedInputs, 'toolchain') // => null
 * ```
 */
export function lastPropertyOf(object: JsonObjectNode, name: string): JsonPropertyNode | null {
  return object.properties.reduce<JsonPropertyNode | null>((last, property) => (property.key.value === name ? property : last), null)
}
