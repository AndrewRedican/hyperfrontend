import { createHash } from '@hyperfrontend/cryptography/node'
import { createDataFactory } from './create-data-factory'
import * as getSchemaModule from './get-schema'
import { dataCreatorTestCases, invalidDataCreatorTestCases } from './test-fixtures'

describe('createDataFactory (Node.js)', () => {
  describe('valid data creation', () => {
    dataCreatorTestCases.forEach(({ description, pid, sequence, message }) => {
      it(`creates data with ${description}`, async () => {
        const createData = createDataFactory(createHash)
        const result = await createData(pid, sequence, message)

        expect(result).toBeDefined()
        expect(result.pid).toBe(pid)
        expect(result.sequence).toBe(sequence)
        expect(result.id).toBeDefined()
        expect(typeof result.id).toBe('string')
        expect(result.key).toBeDefined()
        expect(typeof result.key).toBe('string')
        expect(result.message).toBe(JSON.stringify(message))
        expect(result.schema).toBeDefined()
        expect(result.schemaHash).toBeDefined()
        expect(typeof result.schemaHash).toBe('string')
      })
    })

    it('generates unique IDs for each data object', async () => {
      const createData = createDataFactory(createHash)
      const data1 = await createData('550e8400-e29b-41d4-a716-446655440000', 1, { test: 'data' })
      const data2 = await createData('550e8400-e29b-41d4-a716-446655440000', 1, { test: 'data' })

      expect(data1.id).not.toBe(data2.id)
      expect(data1.key).not.toBe(data2.key)
    })

    it('generates consistent schema hash for same message structure', async () => {
      const createData = createDataFactory(createHash)
      const data1 = await createData('550e8400-e29b-41d4-a716-446655440000', 1, { test: 'value1' })
      const data2 = await createData('550e8400-e29b-41d4-a716-446655440001', 2, { test: 'value2' })

      expect(data1.schemaHash).toBe(data2.schemaHash)
    })

    it('generates different schema hashes for different message structures', async () => {
      const createData = createDataFactory(createHash)
      const data1 = await createData('550e8400-e29b-41d4-a716-446655440000', 1, { field1: 'value' })
      const data2 = await createData('550e8400-e29b-41d4-a716-446655440001', 2, { field2: 'value' })

      expect(data1.schemaHash).not.toBe(data2.schemaHash)
    })

    it('returns frozen data object', async () => {
      const createData = createDataFactory(createHash)
      const data = await createData('550e8400-e29b-41d4-a716-446655440000', 1, { test: 'data' })

      expect(Object.isFrozen(data)).toBe(true)
    })

    it('serializes message to JSON string', async () => {
      const createData = createDataFactory(createHash)
      const message = { nested: { value: 42 } }
      const data = await createData('550e8400-e29b-41d4-a716-446655440000', 1, message)

      expect(data.message).toBe(JSON.stringify(message))
      expect(JSON.parse(data.message)).toEqual(message)
    })
  })

  describe('error handling', () => {
    invalidDataCreatorTestCases.forEach(({ description, pid, sequence, message }) => {
      it(`handles ${description}`, async () => {
        const createData = createDataFactory(createHash)

        await expect(createData(<string>pid, sequence, message)).rejects.toThrow()
      })
    })

    it('handles circular references', async () => {
      const createData = createDataFactory(createHash)
      const circular: { self?: unknown } = {}
      circular.self = circular

      await expect(createData('550e8400-e29b-41d4-a716-446655440000', 1, circular)).rejects.toThrow('circular')
    })

    it('handles unserializable message', async () => {
      const createData = createDataFactory(createHash)
      const message = { fn: () => 'test' } // Functions are not JSON-serializable

      await expect(createData('550e8400-e29b-41d4-a716-446655440000', 1, message)).rejects.toThrow()
    })

    it('handles hash creation failure', async () => {
      const failingHash = jest.fn().mockRejectedValue(new Error('Hash failed'))
      const createData = createDataFactory(failingHash)

      await expect(createData('550e8400-e29b-41d4-a716-446655440000', 1, { test: 'data' })).rejects.toThrow(
        'Cannot create data because failed to hash schema'
      )
    })

    it('handles schema creation failure by using problematic input', async () => {
      const createData = createDataFactory(createHash)

      jest.spyOn(getSchemaModule, 'getSchema').mockImplementationOnce(() => {
        throw new Error('Schema creation failed')
      })

      await expect(createData('550e8400-e29b-41d4-a716-446655440000', 1, { test: 'data' })).rejects.toThrow(
        'Cannot create data because failed to create a schema'
      )

      jest.restoreAllMocks()
    })
  })
})
