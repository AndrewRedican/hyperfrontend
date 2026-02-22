import { toJsonSchema, type Schema } from '@hyperfrontend/json-utils'
import type { SchemaCreater } from '../model'

export const getSchema: SchemaCreater = (data: unknown): Schema => {
  return toJsonSchema(data, { arrays: { mode: 'all' } })
}
