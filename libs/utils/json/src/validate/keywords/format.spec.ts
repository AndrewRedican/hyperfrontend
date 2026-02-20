import { validateFormat } from './format'
import type { Schema } from '../../types'
import type { ValidationContext } from '../context'

describe('validateFormat', () => {
  const ctx = <ValidationContext>{ errors: [] }

  it('returns true if no format', () => {
    expect(validateFormat('abc', {}, ctx)).toBe(true)
  })

  it('returns true for valid email', () => {
    const schema: Schema = { format: 'email' }
    expect(validateFormat('test@example.com', schema, ctx)).toBe(true)
  })

  it('returns false for invalid email', () => {
    const schema: Schema = { format: 'email' }
    expect(validateFormat('not-an-email', schema, ctx)).toBe(false)
  })

  it('returns true for valid date', () => {
    const schema: Schema = { format: 'date' }
    expect(validateFormat('2020-01-01', schema, ctx)).toBe(true)
  })

  it('returns false for invalid date', () => {
    const schema: Schema = { format: 'date' }
    expect(validateFormat('not-a-date', schema, ctx)).toBe(false)
  })

  it('returns false for invalid time', () => {
    const schema: Schema = { format: 'time' }
    expect(validateFormat('25:61:61', schema, ctx)).toBe(false)
    expect(validateFormat('not-a-time', schema, ctx)).toBe(false)
  })

  it('returns true for valid time', () => {
    const schema: Schema = { format: 'time' }
    expect(validateFormat('12:34:56', schema, ctx)).toBe(true)
    expect(validateFormat('23:59:59.999Z', schema, ctx)).toBe(true)
    expect(validateFormat('01:02:03+02:00', schema, ctx)).toBe(true)
  })

  it('returns true for valid hostname', () => {
    const schema: Schema = { format: 'hostname' }
    expect(validateFormat('example.com', schema, ctx)).toBe(true)
    expect(validateFormat('sub.domain.example', schema, ctx)).toBe(true)
  })

  it('returns false for invalid hostname', () => {
    const schema: Schema = { format: 'hostname' }
    expect(validateFormat('-invalid-.com', schema, ctx)).toBe(false)
    expect(validateFormat('invalid_host_name', schema, ctx)).toBe(false)
  })

  it('returns true for valid ipv4', () => {
    const schema: Schema = { format: 'ipv4' }
    expect(validateFormat('192.168.1.1', schema, ctx)).toBe(true)
    expect(validateFormat('0.0.0.0', schema, ctx)).toBe(true)
    expect(validateFormat('255.255.255.255', schema, ctx)).toBe(true)
  })

  it('returns false for invalid ipv4', () => {
    const schema: Schema = { format: 'ipv4' }
    expect(validateFormat('256.100.100.100', schema, ctx)).toBe(false)
    expect(validateFormat('192.168.1', schema, ctx)).toBe(false)
    expect(validateFormat('abc.def.ghi.jkl', schema, ctx)).toBe(false)
  })

  it('returns false for invalid url', () => {
    const schema: Schema = { format: 'uri' }
    expect(validateFormat('not a url', schema, ctx)).toBe(false)
  })

  it('returns false for invalid regex', () => {
    const schema: Schema = { format: 'regex' }
    expect(validateFormat('[unclosed', schema, ctx)).toBe(false)
  })

  it('returns true for valid uuid', () => {
    const schema: Schema = { format: 'uuid' }
    expect(validateFormat('123e4567-e89b-12d3-a456-426614174000', schema, ctx)).toBe(true)
  })

  it('returns false for invalid uuid', () => {
    const schema: Schema = { format: 'uuid' }
    expect(validateFormat('not-a-uuid', schema, ctx)).toBe(false)
  })
})
