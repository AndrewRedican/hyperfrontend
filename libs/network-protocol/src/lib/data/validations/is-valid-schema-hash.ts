import { isSHA256Hash } from '@hyperfrontend/cryptography/common'

export function isValidSchemaHash(schemaHash: unknown): boolean {
  return isSHA256Hash(schemaHash)
}
