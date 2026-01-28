import { Validator } from 'jsonschema'
/* istanbul ignore next - JSON import causes coverage artifact */
import * as v4Schema from './v4.json'

export function isValidSchema(schema: unknown): boolean {
  return new Validator().validate(schema, v4Schema).valid
}
