/**
 * Internal utility functions for validation
 * These are simple implementations to avoid external dependencies
 */

import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

/**
 * Check if value is an object (not null, not array)
 *
 * @param value - The value to check
 * @returns True if value is a plain object
 */
export function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !isArray(value)
}

/**
 * Check if a string is empty after trimming
 *
 * @param str - The string to check
 * @returns True if string is empty after trimming
 */
export function isEmpty(str: string): boolean {
  return typeof str === 'string' && str.trim().length === 0
}
