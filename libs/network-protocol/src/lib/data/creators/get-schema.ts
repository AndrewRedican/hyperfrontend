import type { Schema } from '@hyperfrontend/json-utils'
import type { SchemaCreater } from '../model'
import { toJsonSchema } from '@hyperfrontend/json-utils'

/**
 * Creates a JSON schema from the provided data.
 *
 * @param data - The data to analyze and generate a schema from
 * @returns A JSON schema representing the structure of the input data
 *
 * @example Generating a schema from an object
 * ```typescript
 * const schema = getSchema({ name: 'Alice', age: 30 })
 * // => { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer' } } }
 * ```
 */
export const getSchema: SchemaCreater = (data: unknown): Schema => {
  return toJsonSchema(data, { arrays: { mode: 'all' } })
}
