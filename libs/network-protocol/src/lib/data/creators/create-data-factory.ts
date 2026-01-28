import type { Schema } from 'jsonschema'
import type { DataCreater, JSONString, SerializedData } from '../model'
import { hasCircularReference } from '@hyperfrontend/data-utils'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { isValidPid, isValidSequence, isValidMessage } from '../validations'
import { getSchema } from './get-schema'

/**
 * Creates a data creator function with the provided hash implementation.
 *
 * @param createHash - Function that creates a hash from a string using a specified algorithm
 * @returns A DataCreater function that creates Data objects with encrypted schema hashes
 *
 * @example
 * ```typescript
 * import { createHash } from '@hyperfrontend/cryptography/browser'
 * import { createDataFactory } from '@hyperfrontend/network-protocol/lib/data/creators'
 *
 * const createData = createDataFactory(createHash)
 * const data = await createData('process-123', 1, { hello: 'world' })
 * ```
 */
export function createDataFactory(createHash: (data: string, algorithm: string) => Promise<string>): DataCreater {
  return async <T = unknown>(pid: string, sequence: number, message: T): Promise<SerializedData<T>> => {
    if (!isValidPid(pid)) {
      throw new Error('Cannot create data without a valid pid')
    }
    if (!isValidSequence(sequence)) {
      throw new Error('Cannot create data without a valid sequence')
    }
    if (hasCircularReference(message)) {
      throw new Error('Cannot create data with a message with circular references')
    }
    if (!isValidMessage(message)) {
      throw new Error('Cannot create data without a valid message')
    }
    let serialized: JSONString<T>
    try {
      serialized = <JSONString<T>>JSON.stringify(message)
    } /* istanbul ignore next - covered by hasCircularReference check above */ catch {
      throw new Error('Cannot create data with unserializable message')
    }
    let schema: Schema
    try {
      schema = getSchema(message)
    } catch {
      throw new Error('Cannot create data because failed to create a schema')
    }
    let schemaHash: string
    try {
      schemaHash = await createHash(JSON.stringify(schema), 'SHA-256')
    } /* istanbul ignore next - hash failure would indicate system-level crypto issues */ catch {
      throw new Error('Cannot create data because failed to hash schema')
    }
    const id = uuidV4()
    const key = uuidV4()
    const data: SerializedData<T> = {
      pid,
      id,
      sequence,
      key,
      message: serialized as any, // Runtime: string, Type: JSONString<T>
      schema,
      schemaHash,
    }
    return Object.freeze(data)
  }
}
