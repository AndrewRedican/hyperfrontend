import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { createDate, dateParse, dateUTC } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { globalIsNaN, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { addError } from '../context'

/**
 * Format validators for common string formats.
 */
const formatValidators: Record<string, (value: string) => boolean> = {
  'date-time': (v) => {
    // ISO 8601 date-time format - anchored to prevent matching at unexpected locations
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return false
    const date = dateParse(v)
    return !globalIsNaN(date)
  },

  date: (v) => {
    // ISO 8601 date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
    const [year, month, day] = v.split('-').map(Number)
    const date = createDate(dateUTC(year, month - 1, day))
    // Check that the date components match exactly
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  },

  time: (v) => {
    // ISO 8601 time format (HH:MM:SS or HH:MM:SS.sss with optional timezone)
    // Parse segments to avoid nested quantifiers
    const mainMatch = v.match(/^(\d{2}):(\d{2}):(\d{2})/)
    if (!mainMatch) return false
    const hour = Number(mainMatch[1])
    const minute = Number(mainMatch[2])
    const second = Number(mainMatch[3])
    if (hour > 23 || minute > 59 || second > 59) return false
    // Validate remaining part (fractional seconds and/or timezone)
    const rest = v.slice(8)
    if (rest === '') return true
    // Fractional seconds: .ddd where d is digits (1-6 typically)
    if (rest.match(/^\.\d{1,9}$/)) return true
    // Timezone only: Z or +HH:MM or -HH:MM
    if (rest.match(/^(Z|[+-]\d{2}:\d{2})$/)) return true
    // Fractional + timezone
    if (rest.match(/^\.\d{1,9}(Z|[+-]\d{2}:\d{2})$/)) return true
    return false
  },

  email: (v) => {
    // Basic email validation - fixed to prevent ReDoS by excluding dots from domain part
    return /^[^\s@]+@[^\s@.]+\.[^\s@.]+$/.test(v)
  },

  hostname: (v) => {
    // RFC 1123 hostname - validated per label to prevent ReDoS
    if (v.length > 253 || v.length === 0) return false // Max hostname length per RFC
    const labels = v.split('.')
    for (const label of labels) {
      if (label.length === 0 || label.length > 63) return false
      // Start and end with alphanumeric
      if (!/^[a-zA-Z0-9]$/.test(label[0])) return false
      if (label.length > 1 && !/^[a-zA-Z0-9]$/.test(label[label.length - 1])) return false
      // Middle can include hyphens
      for (let i = 1; i < label.length - 1; i++) {
        if (!/^[a-zA-Z0-9-]$/.test(label[i])) return false
      }
    }
    return true
  },

  ipv4: (v) => {
    // IPv4 address
    const parts = v.split('.')
    if (parts.length !== 4) return false
    return parts.every((part) => {
      const num = parseInt(part, 10)
      return !globalIsNaN(num) && num >= 0 && num <= 255 && part === String(num)
    })
  },

  ipv6: (v) => {
    // Simplified IPv6 validation - procedural approach to avoid ReDoS
    if (v === '::') return true
    // Check for double colon (compressed form)
    const hasDoubleColon = v.includes('::')

    if (!hasDoubleColon) {
      // Full form: exactly 8 groups separated by single colons
      const groups = v.split(':')
      if (groups.length !== 8) return false
      const hexGroup = /^[0-9a-fA-F]{1,4}$/
      return groups.every((g) => hexGroup.test(g))
    }

    // Compressed form: validate :: appears exactly once and total groups <= 8
    const parts = v.split('::')
    if (parts.length !== 2) return false
    const left = parts[0] ? parts[0].split(':').filter(Boolean) : []
    const right = parts[1] ? parts[1].split(':').filter(Boolean) : []
    if (left.length + right.length > 7) return false
    const hexGroup = /^[0-9a-fA-F]{1,4}$/
    return left.every((g) => hexGroup.test(g)) && right.every((g) => hexGroup.test(g))
  },

  uri: (v) => {
    // Basic URI validation
    try {
      createURL(v)
      return true
      /* istanbul ignore next -- URL constructor always throws for invalid URI */
    } catch {
      return false
    }
  },

  'uri-reference': (v) => {
    // URI or relative reference
    try {
      createURL(v, 'http://example.com')
      /* istanbul ignore next -- success path just returns true */
      return true
    } catch {
      /* istanbul ignore next -- URL constructor is very permissive with base URL */
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
      // eslint-disable-next-line workspace/no-unsafe-regex -- intentionally validating user-provided regex patterns
      createRegExp(v)
      return true
    } catch {
      return false
    }
  },

  'json-pointer': (v) => {
    // JSON Pointer format - validate segment by segment to avoid nested quantifiers
    if (v === '') return true
    if (!v.startsWith('/')) return false
    const segments = v.slice(1).split('/')
    const validSegment = /^([^/~]|~[01])*$/
    return segments.every((seg) => validSegment.test(seg))
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
