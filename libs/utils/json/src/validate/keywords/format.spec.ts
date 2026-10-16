import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateFormat } from './format'

describe('validateFormat', () => {
  const ctx = { errors: [] } as ValidationContext

  it('returns true if no format', () => {
    expect(validateFormat('abc', {}, ctx)).toBe(true)
  })

  it('returns true for unknown format', () => {
    const schema: Schema = { format: 'unknown-format' }
    expect(validateFormat('anything', schema, ctx)).toBe(true)
  })

  describe('email format', () => {
    it('returns true for valid email', () => {
      const schema: Schema = { format: 'email' }
      expect(validateFormat('test@example.com', schema, ctx)).toBe(true)
    })

    it('returns false for invalid email', () => {
      const schema: Schema = { format: 'email' }
      expect(validateFormat('not-an-email', schema, ctx)).toBe(false)
    })

    it.each(['user@mail.example.com', 'first.last@sub.dept.example.co.uk'])(
      'returns true for a domain with more than two labels %p',
      (value: string) => {
        const schema: Schema = { format: 'email' }
        expect(validateFormat(value, schema, ctx)).toBe(true)
      }
    )

    it('returns false for a domain without a dot', () => {
      const schema: Schema = { format: 'email' }
      expect(validateFormat('user@localhost', schema, ctx)).toBe(false)
    })

    it('returns false for a domain that ends with a dot', () => {
      const schema: Schema = { format: 'email' }
      expect(validateFormat('user@example.', schema, ctx)).toBe(false)
    })
  })

  describe('date format', () => {
    it.each(['2020-01-01', '2024-12-31'])('returns true for valid date %p', (value: string) => {
      const schema: Schema = { format: 'date' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it('returns false for invalid date', () => {
      const schema: Schema = { format: 'date' }
      expect(validateFormat('not-a-date', schema, ctx)).toBe(false)
    })

    it.each(['2020-02-30', '2020-13-01', '2020-01-32'])('returns false for invalid date components %p', (value: string) => {
      const schema: Schema = { format: 'date' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })
  })

  describe('time format', () => {
    it.each(['25:61:61', 'not-a-time'])('returns false for invalid time %p', (value: string) => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })

    it.each(['12:34:56', '23:59:59.999Z', '01:02:03+02:00'])('returns true for valid time %p', (value: string) => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it.each(['12:34:56.123', '00:00:00.000000001'])('returns true for time with fractional seconds only %p', (value: string) => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it.each(['12:34:56Z', '12:34:56-05:00'])('returns true for time with timezone only %p', (value: string) => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it.each(['12:34:56.abc', '12:34:56X'])('returns false for time with invalid suffix %p', (value: string) => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })
  })

  describe('date-time format', () => {
    it.each(['2024-01-15T10:30:00Z', '2024-01-15T10:30:00+05:00'])('returns true for valid date-time %p', (value: string) => {
      const schema: Schema = { format: 'date-time' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it.each(['not-a-datetime', '2024-01-15'])('returns false for invalid date-time %p', (value: string) => {
      const schema: Schema = { format: 'date-time' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })
  })

  describe('hostname format', () => {
    it.each(['example.com', 'sub.domain.example'])('returns true for valid hostname %p', (value: string) => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it.each(['-invalid-.com', 'invalid_host_name'])('returns false for invalid hostname %p', (value: string) => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })

    it.each(['a', 'a.b.c'])('returns true for single-character labels %p', (value: string) => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it('returns false for empty hostname', () => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat('', schema, ctx)).toBe(false)
    })

    it.each(['example..com', '.example.com'])('returns false for hostname with empty label %p', (value: string) => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })

    it('returns false for label ending with hyphen', () => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat('test-.com', schema, ctx)).toBe(false)
    })

    it('returns false for too long hostname', () => {
      const schema: Schema = { format: 'hostname' }
      const longHostname = 'a'.repeat(254)
      expect(validateFormat(longHostname, schema, ctx)).toBe(false)
    })

    it('returns false for too long label', () => {
      const schema: Schema = { format: 'hostname' }
      const longLabel = 'a'.repeat(64) + '.com'
      expect(validateFormat(longLabel, schema, ctx)).toBe(false)
    })
  })

  describe('ipv4 format', () => {
    it.each(['192.168.1.1', '0.0.0.0', '255.255.255.255'])('returns true for valid ipv4 %p', (value: string) => {
      const schema: Schema = { format: 'ipv4' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it.each(['256.100.100.100', '192.168.1', 'abc.def.ghi.jkl'])('returns false for invalid ipv4 %p', (value: string) => {
      const schema: Schema = { format: 'ipv4' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })

    it('returns false for ipv4 with leading zeros', () => {
      const schema: Schema = { format: 'ipv4' }
      expect(validateFormat('192.168.01.1', schema, ctx)).toBe(false)
    })
  })

  describe('ipv6 format', () => {
    it.each(['2001:0db8:85a3:0000:0000:8a2e:0370:7334', '2001:db8:85a3:0:0:8a2e:370:7334', '::', '::1', 'fe80::'])(
      'returns true for valid ipv6 %p',
      (value: string) => {
        const schema: Schema = { format: 'ipv6' }
        expect(validateFormat(value, schema, ctx)).toBe(true)
      }
    )

    it.each(['not-an-ipv6', '192.168.1.1', '2001:db8:85a3::8a2e:370g:7334'])('returns false for invalid ipv6 %p', (value: string) => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat(value, schema, ctx)).toBe(false)
    })

    it.each(['1:2:3:4:5:6:7::8', '1:2:3:4::5:6:7:8'])(
      'returns false for ipv6 with too many groups in compressed form %p',
      (value: string) => {
        const schema: Schema = { format: 'ipv6' }
        expect(validateFormat(value, schema, ctx)).toBe(false)
      }
    )

    it('returns false for ipv6 with multiple :: sequences', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('2001::db8::1', schema, ctx)).toBe(false)
    })

    it('returns true for ipv6 compressed with valid group count', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('2001:db8::1', schema, ctx)).toBe(true)
    })

    it('returns false for compressed ipv6 ending in a dotted ipv4 group', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('::ffff:192.0.2.1', schema, ctx)).toBe(false)
    })
  })

  describe('uri format', () => {
    it.each(['https://example.com', 'http://example.com/path?query=1'])('returns true for valid uri %p', (value: string) => {
      const schema: Schema = { format: 'uri' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it('returns false for invalid uri', () => {
      const schema: Schema = { format: 'uri' }
      expect(validateFormat('not a url', schema, ctx)).toBe(false)
    })
  })

  describe('uri-reference format', () => {
    it.each(['/path/to/resource', '../relative/path', 'https://example.com'])(
      'returns true for valid uri-reference %p',
      (value: string) => {
        const schema: Schema = { format: 'uri-reference' }
        expect(validateFormat(value, schema, ctx)).toBe(true)
      }
    )

    // Note: uri-reference accepts most strings as valid relative references
  })

  describe('regex format', () => {
    it.each(['^[a-z]+$', '\\d{3}-\\d{4}'])('returns true for valid regex %p', (value: string) => {
      const schema: Schema = { format: 'regex' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it('returns false for invalid regex', () => {
      const schema: Schema = { format: 'regex' }
      expect(validateFormat('[unclosed', schema, ctx)).toBe(false)
    })
  })

  describe('uuid format', () => {
    it('returns true for valid uuid', () => {
      const schema: Schema = { format: 'uuid' }
      expect(validateFormat('123e4567-e89b-12d3-a456-426614174000', schema, ctx)).toBe(true)
    })

    it('returns false for invalid uuid', () => {
      const schema: Schema = { format: 'uuid' }
      expect(validateFormat('not-a-uuid', schema, ctx)).toBe(false)
    })
  })

  describe('json-pointer format', () => {
    it.each(['', '/foo/bar', '/a~0b', '/a~1b'])('returns true for valid json-pointer %p', (value: string) => {
      const schema: Schema = { format: 'json-pointer' }
      expect(validateFormat(value, schema, ctx)).toBe(true)
    })

    it('returns false for invalid json-pointer', () => {
      const schema: Schema = { format: 'json-pointer' }
      expect(validateFormat('invalid', schema, ctx)).toBe(false)
    })
  })
})
