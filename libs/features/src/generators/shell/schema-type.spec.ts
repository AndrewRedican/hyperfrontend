import { schemaToType } from './schema-type'

describe('schemaToType', () => {
  it('falls back to unknown for a missing schema', () => {
    expect(schemaToType(undefined)).toBe('unknown')
  })

  it('falls back to unknown for a non-object schema', () => {
    expect(schemaToType('string')).toBe('unknown')
  })

  it('falls back to unknown for an array-valued schema', () => {
    expect(schemaToType([{ type: 'string' }])).toBe('unknown')
  })

  it('maps type string to string', () => {
    expect(schemaToType({ type: 'string' })).toBe('string')
  })

  it('maps type number to number', () => {
    expect(schemaToType({ type: 'number' })).toBe('number')
  })

  it('maps type integer to number', () => {
    expect(schemaToType({ type: 'integer' })).toBe('number')
  })

  it('maps type boolean to boolean', () => {
    expect(schemaToType({ type: 'boolean' })).toBe('boolean')
  })

  it('maps type null to null', () => {
    expect(schemaToType({ type: 'null' })).toBe('null')
  })

  it('falls back to unknown for an unsupported type keyword', () => {
    expect(schemaToType({ type: 'binary' })).toBe('unknown')
  })

  it('falls back to unknown for a non-string type keyword', () => {
    expect(schemaToType({ type: ['string', 'null'] })).toBe('unknown')
  })

  it('falls back to unknown for a schema without a type keyword', () => {
    expect(schemaToType({ description: 'anything' })).toBe('unknown')
  })

  it('maps a string enum to a union of string literals', () => {
    expect(schemaToType({ enum: ['UTC', 'local'] })).toBe("'UTC' | 'local'")
  })

  it('maps a mixed scalar enum to a union of literal types', () => {
    expect(schemaToType({ enum: ['auto', 12, true, null] })).toBe("'auto' | 12 | true | null")
  })

  it('falls back to unknown when an enum member is not a scalar', () => {
    expect(schemaToType({ enum: ['UTC', { zone: 'x' }] })).toBe('unknown')
  })

  it('ignores an empty enum list and maps the type keyword instead', () => {
    expect(schemaToType({ enum: [], type: 'string' })).toBe('string')
  })

  it('maps a string const to its literal type', () => {
    expect(schemaToType({ const: 'fixed' })).toBe("'fixed'")
  })

  it('maps a numeric const to its literal type', () => {
    expect(schemaToType({ const: 3 })).toBe('3')
  })

  it('maps a null const to null', () => {
    expect(schemaToType({ const: null })).toBe('null')
  })

  it('falls back to unknown for a non-scalar const', () => {
    expect(schemaToType({ const: { fixed: true } })).toBe('unknown')
  })

  it('prefers enum over const when both are present', () => {
    expect(schemaToType({ enum: ['a'], const: 'b' })).toBe("'a'")
  })

  it('maps an object schema with required and optional properties', () => {
    expect(schemaToType({ type: 'object', properties: { tz: { type: 'string' }, label: { type: 'string' } }, required: ['tz'] })).toBe(
      '{\n  tz: string\n  label?: string\n}'
    )
  })

  it('treats a malformed required keyword as no properties being required', () => {
    expect(schemaToType({ type: 'object', properties: { tz: { type: 'string' } }, required: 'tz' })).toBe('{\n  tz?: string\n}')
  })

  it('maps an object schema without properties to an open record', () => {
    expect(schemaToType({ type: 'object' })).toBe('Record<string, unknown>')
  })

  it('maps an object schema with empty properties to an open record', () => {
    expect(schemaToType({ type: 'object', properties: {} })).toBe('Record<string, unknown>')
  })

  it('quotes property keys that are not valid identifiers', () => {
    expect(schemaToType({ type: 'object', properties: { 'time-zone': { type: 'string' } }, required: ['time-zone'] })).toBe(
      "{\n  'time-zone': string\n}"
    )
  })

  it('indents nested object schemas one level per depth', () => {
    expect(
      schemaToType({
        type: 'object',
        properties: { zone: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        required: ['zone'],
      })
    ).toBe('{\n  zone: {\n    id: string\n  }\n}')
  })

  it('maps an array schema with a scalar items schema', () => {
    expect(schemaToType({ type: 'array', items: { type: 'number' } })).toBe('number[]')
  })

  it('parenthesizes a union element type inside an array', () => {
    expect(schemaToType({ type: 'array', items: { enum: ['a', 'b'] } })).toBe("('a' | 'b')[]")
  })

  it('maps an array schema without items to an unknown array', () => {
    expect(schemaToType({ type: 'array' })).toBe('unknown[]')
  })

  it('maps a tuple-style items list to an unknown array', () => {
    expect(schemaToType({ type: 'array', items: [{ type: 'string' }, { type: 'number' }] })).toBe('unknown[]')
  })

  it('maps an array of objects with nested members', () => {
    expect(schemaToType({ type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] } })).toBe(
      '{\n  id: number\n}[]'
    )
  })
})
