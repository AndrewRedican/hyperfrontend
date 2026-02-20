import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { addError } from '../context'

/**
 * Format validators for common string formats.
 */
const formatValidators: Record<string, (value: string) => boolean> = {
  'date-time': (v) => {
    // ISO 8601 date-time format - anchored to prevent matching at unexpected locations
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return false
    const date = Date.parse(v)
    return !isNaN(date)
  },

  date: (v) => {
    // ISO 8601 date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
    const [year, month, day] = v.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    // Check that the date components match exactly
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  },

  time: (v) => {
    // ISO 8601 time format (HH:MM:SS or HH:MM:SS.sss)
    const match = v.match(/^(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/)
    if (!match) return false
    const hour = Number(match[1])
    const minute = Number(match[2])
    const second = Number(match[3])
    if (hour > 23 || minute > 59 || second > 59) return false
    return true
  },

  email: (v) => {
    // Basic email validation - fixed to prevent ReDoS by excluding dots from domain part
    return /^[^\s@]+@[^\s@.]+\.[^\s@.]+$/.test(v)
  },

  hostname: (v) => {
    // RFC 1123 hostname
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(v)
  },

  ipv4: (v) => {
    // IPv4 address
    const parts = v.split('.')
    if (parts.length !== 4) return false
    return parts.every((part) => {
      const num = parseInt(part, 10)
      return !isNaN(num) && num >= 0 && num <= 255 && part === String(num)
    })
  },

  ipv6: (v) => {
    // Simplified IPv6 validation
    return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?$/.test(
      v
    )
  },

  uri: (v) => {
    // Basic URI validation
    try {
      new URL(v)
      return true
    } catch {
      return false
    }
  },

  'uri-reference': (v) => {
    // URI or relative reference
    try {
      new URL(v, 'http://example.com')
      return true
    } catch {
      return false
    }
  },

  uuid: (v) => {
    // UUID format
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
  },

  regex: (v) => {
    // Valid regex pattern
    try {
      new RegExp(v)
      return true
    } catch {
      return false
    }
  },

  'json-pointer': (v) => {
    // JSON Pointer format
    return v === '' || /^(\/([^/~]|~[01])*)*$/.test(v)
  },
}

/**
 * Validates string format constraint.
 *
 * @param instance - String being validated
 * @param schema - Schema containing the format constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateFormat(instance: string, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.format) {
    return true
  }

  const validator = formatValidators[schema.format]
  if (!validator) {
    // Unknown format - allow by default (as per JSON Schema spec)
    return true
  }

  if (!validator(instance)) {
    addError(ctx, `String does not match format '${schema.format}'`, instance, 'format', {
      format: schema.format,
    })
    return false
  }

  return true
}
