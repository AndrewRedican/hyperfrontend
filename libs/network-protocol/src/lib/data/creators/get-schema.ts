import type { Schema } from '@hyperfrontend/json-utils'
import type { SchemaCreater } from '../model'
import { toJsonSchema } from '@hyperfrontend/json-utils'

export const getSchema: SchemaCreater = (data: unknown): Schema => {
  return toJsonSchema(data, { arrays: { mode: 'all' } })
}
