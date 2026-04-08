import { random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a version 4 UUID.
 *
 * @returns a version 4 UUID.
 *
 * @example Creating unique identifiers for entities
 * ```typescript
 * const userId = uuidV4()
 * // => 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
 *
 * const sessionId = uuidV4()
 * // => '9f8e7d6c-5b4a-4321-8765-4321fedcba98'
 * ```
 */
export function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const randomHex = (random() * 16) | 0

    const finalHex = char === 'x' ? randomHex : (randomHex & 0x3) | 0x8

    return finalHex.toString(16)
  })
}

/**
 * Validate if a string is a version 4 UUID.
 *
 * @param str the string to be validated.
 * @returns true if the string is a version 4 UUID, otherwise false.
 *
 * @example Validating user input as UUID
 * ```typescript
 * isUuidV4('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')
 * // => true
 *
 * isUuidV4('not-a-uuid')
 * // => false
 *
 * // Version 1 UUID (has '1' in third segment, not '4')
 * isUuidV4('550e8400-e29b-11d4-a716-446655440000')
 * // => false
 * ```
 */
export function isUuidV4(str: string): boolean {
  const pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
  return pattern.test(str)
}
