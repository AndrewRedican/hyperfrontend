import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
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
  })

  describe('date format', () => {
    it('returns true for valid date', () => {
      const schema: Schema = { format: 'date' }
      expect(validateFormat('2020-01-01', schema, ctx)).toBe(true)
      expect(validateFormat('2024-12-31', schema, ctx)).toBe(true)
    })

    it('returns false for invalid date', () => {
      const schema: Schema = { format: 'date' }
      expect(validateFormat('not-a-date', schema, ctx)).toBe(false)
    })

    it('returns false for invalid date components', () => {
      const schema: Schema = { format: 'date' }
      expect(validateFormat('2020-02-30', schema, ctx)).toBe(false)
      expect(validateFormat('2020-13-01', schema, ctx)).toBe(false)
      expect(validateFormat('2020-01-32', schema, ctx)).toBe(false)
    })
  })

  describe('time format', () => {
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

    it('returns true for time with fractional seconds only', () => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat('12:34:56.123', schema, ctx)).toBe(true)
      expect(validateFormat('00:00:00.000000001', schema, ctx)).toBe(true)
    })

    it('returns true for time with timezone only', () => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat('12:34:56Z', schema, ctx)).toBe(true)
      expect(validateFormat('12:34:56-05:00', schema, ctx)).toBe(true)
    })

    it('returns false for time with invalid suffix', () => {
      const schema: Schema = { format: 'time' }
      expect(validateFormat('12:34:56.abc', schema, ctx)).toBe(false)
      expect(validateFormat('12:34:56X', schema, ctx)).toBe(false)
    })
  })

  describe('date-time format', () => {
    it('returns true for valid date-time', () => {
      const schema: Schema = { format: 'date-time' }
      expect(validateFormat('2024-01-15T10:30:00Z', schema, ctx)).toBe(true)
      expect(validateFormat('2024-01-15T10:30:00+05:00', schema, ctx)).toBe(true)
    })

    it('returns false for invalid date-time', () => {
      const schema: Schema = { format: 'date-time' }
      expect(validateFormat('not-a-datetime', schema, ctx)).toBe(false)
      expect(validateFormat('2024-01-15', schema, ctx)).toBe(false)
    })
  })

  describe('hostname format', () => {
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

    it('returns true for single-character labels', () => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat('a', schema, ctx)).toBe(true)
      expect(validateFormat('a.b.c', schema, ctx)).toBe(true)
    })

    it('returns false for empty hostname', () => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat('', schema, ctx)).toBe(false)
    })

    it('returns false for hostname with empty label', () => {
      const schema: Schema = { format: 'hostname' }
      expect(validateFormat('example..com', schema, ctx)).toBe(false)
      expect(validateFormat('.example.com', schema, ctx)).toBe(false)
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

    it('returns false for ipv4 with leading zeros', () => {
      const schema: Schema = { format: 'ipv4' }
      expect(validateFormat('192.168.01.1', schema, ctx)).toBe(false)
    })
  })

  describe('ipv6 format', () => {
    it('returns true for valid ipv6', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('2001:0db8:85a3:0000:0000:8a2e:0370:7334', schema, ctx)).toBe(true)
      expect(validateFormat('2001:db8:85a3:0:0:8a2e:370:7334', schema, ctx)).toBe(true)
      expect(validateFormat('::', schema, ctx)).toBe(true)
      expect(validateFormat('::1', schema, ctx)).toBe(true)
      expect(validateFormat('fe80::', schema, ctx)).toBe(true)
    })

    it('returns false for invalid ipv6', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('not-an-ipv6', schema, ctx)).toBe(false)
      expect(validateFormat('192.168.1.1', schema, ctx)).toBe(false)
      expect(validateFormat('2001:db8:85a3::8a2e:370g:7334', schema, ctx)).toBe(false)
    })

    it('returns false for ipv6 with too many groups in compressed form', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('1:2:3:4:5:6:7::8', schema, ctx)).toBe(false)
      expect(validateFormat('1:2:3:4::5:6:7:8', schema, ctx)).toBe(false)
    })

    it('returns false for ipv6 with multiple :: sequences', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('2001::db8::1', schema, ctx)).toBe(false)
    })

    it('returns true for ipv6 compressed with valid group count', () => {
      const schema: Schema = { format: 'ipv6' }
      expect(validateFormat('2001:db8::1', schema, ctx)).toBe(true)
      expect(validateFormat('::ffff:192.0.2.1', schema, ctx)).toBe(false)
    })
  })

  describe('uri format', () => {
    it('returns true for valid uri', () => {
      const schema: Schema = { format: 'uri' }
      expect(validateFormat('https://example.com', schema, ctx)).toBe(true)
      expect(validateFormat('http://example.com/path?query=1', schema, ctx)).toBe(true)
    })

    it('returns false for invalid uri', () => {
      const schema: Schema = { format: 'uri' }
      expect(validateFormat('not a url', schema, ctx)).toBe(false)
    })
  })

  describe('uri-reference format', () => {
    it('returns true for valid uri-reference', () => {
      const schema: Schema = { format: 'uri-reference' }
      expect(validateFormat('/path/to/resource', schema, ctx)).toBe(true)
      expect(validateFormat('../relative/path', schema, ctx)).toBe(true)
      expect(validateFormat('https://example.com', schema, ctx)).toBe(true)
    })

    // Note: uri-reference accepts most strings as valid relative references
  })

  describe('regex format', () => {
    it('returns true for valid regex', () => {
      const schema: Schema = { format: 'regex' }
      expect(validateFormat('^[a-z]+$', schema, ctx)).toBe(true)
      expect(validateFormat('\\d{3}-\\d{4}', schema, ctx)).toBe(true)
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
    it('returns true for valid json-pointer', () => {
      const schema: Schema = { format: 'json-pointer' }
      expect(validateFormat('', schema, ctx)).toBe(true)
      expect(validateFormat('/foo/bar', schema, ctx)).toBe(true)
      expect(validateFormat('/a~0b', schema, ctx)).toBe(true)
      expect(validateFormat('/a~1b', schema, ctx)).toBe(true)
    })

    it('returns false for invalid json-pointer', () => {
      const schema: Schema = { format: 'json-pointer' }
      expect(validateFormat('invalid', schema, ctx)).toBe(false)
    })
  })
})
