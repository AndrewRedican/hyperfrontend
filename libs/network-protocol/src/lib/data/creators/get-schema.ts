import type { Schema } from '@hyperfrontend/json-utils'
import type { SchemaCreater } from '../model'
import { toJsonSchema } from '@hyperfrontend/json-utils'

/**
 * Creates a JSON schema from the provided data.
 *
 * @param data - The data to analyze and generate a schema from
 * @returns A JSON schema representing the structure of the input data
 */
export const getSchema: SchemaCreater = (data: unknown): Schema => {
  return toJsonSchema(data, { arrays: { mode: 'all' } })
}
