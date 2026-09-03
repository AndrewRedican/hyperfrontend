/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Schema } from '@hyperfrontend/json-utils'
import { before as beforeAll } from 'node:test'
import { createHash } from '@hyperfrontend/cryptography/node'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getSchema } from '../creators/get-schema'
import { isValidUnencryptedData } from './is-valid-unencrypted-data'

describe('isValidUnencryptedData', () => {
  let pid: string
  let id: string
  let sequence: number
  let message: any
  let schema: Schema
  let schemaHash: string

  beforeAll(async () => {
    pid = uuidV4()
    id = uuidV4()
    sequence = 1
    message = { en: 'hello', es: 'hola' }
    schema = getSchema(message)
    schemaHash = await createHash(JSON.stringify(schema), 'SHA-256')
  })

  it('returns true for valid data', () => {
    const validData = {
      pid,
      id,
      sequence,
      message,
      schema,
      schemaHash,
    }
    expect(isValidUnencryptedData(validData)).toBe(true)
  })

  it('returns false for non-object types', () => {
    expect(isValidUnencryptedData('not an object')).toBe(false)
    expect(isValidUnencryptedData(123)).toBe(false)
    expect(isValidUnencryptedData(null)).toBe(false)
    expect(isValidUnencryptedData(void 0)).toBe(false)
  })

  it('returns false for objects missing required properties', () => {
    const incompleteData = {
      pid,
      sequence,
      message,
      schema,
      schemaHash,
    }
    expect(isValidUnencryptedData(incompleteData)).toBe(false)
  })
})
