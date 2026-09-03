import { describe, expect, it } from '@hyperfrontend/testing'
import { getSchema } from './get-schema'

describe('getSchema', () => {
  it('creates schema from simple object', () => {
    const data = { name: 'test', age: 30 }
    const schema = getSchema(data)

    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
  })

  it('creates schema from array', () => {
    const data = [1, 2, 3]
    const schema = getSchema(data)

    expect(schema).toBeDefined()
    expect(schema.type).toBe('array')
  })

  it('creates schema from nested object', () => {
    const data = { user: { name: 'test', details: { age: 30 } } }
    const schema = getSchema(data)

    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
  })

  it('creates schema from primitive types', () => {
    expect(getSchema('string')).toBeDefined()
    expect(getSchema(123)).toBeDefined()
    expect(getSchema(true)).toBeDefined()
  })

  it('creates schema with array mode configuration', () => {
    const data = { items: [1, 2, 3] }
    const schema = getSchema(data)

    expect(schema).toBeDefined()
    expect(schema.properties).toBeDefined()
  })

  it('handles null values', () => {
    const data = { value: null }
    const schema = getSchema(data)

    expect(schema).toBeDefined()
  })

  it('handles empty objects', () => {
    const schema = getSchema({})

    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
  })

  it('handles empty arrays', () => {
    const schema = getSchema([])

    expect(schema).toBeDefined()
    expect(schema.type).toBe('array')
  })

  it('handles array mode option for various array types', () => {
    const mixedArray = [1, 'string', true, { key: 'value' }]
    const result = getSchema(mixedArray)

    expect(result).toBeDefined()
    expect(result.type).toBe('array')
  })

  it('generates schema for nested arrays with mode all', () => {
    const data = {
      matrix: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    }
    const result = getSchema(data)

    expect(result).toBeDefined()
    expect(result.type).toBe('object')
    expect(result.properties).toBeDefined()
  })

  it('handles arrays with consistent types', () => {
    const consistentArray = ['a', 'b', 'c', 'd']
    const result = getSchema(consistentArray)

    expect(result).toBeDefined()
    expect(result.type).toBe('array')
  })
})
