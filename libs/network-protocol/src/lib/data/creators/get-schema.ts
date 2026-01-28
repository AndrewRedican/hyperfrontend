import type { Schema } from 'jsonschema'
import type { SchemaCreater } from '../model'
import toJsonSchema from 'to-json-schema'

export const getSchema: SchemaCreater = (data: unknown): Schema => {
  /* istanbul ignore next - internal library branch in toJsonSchema */
  return toJsonSchema(data, { arrays: { mode: 'all' } }) as Schema
}
