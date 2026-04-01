import { random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a version 4 UUID.
 *
 * @returns a version 4 UUID.
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
 */
export function isUuidV4(str: string): boolean {
  const pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
  return pattern.test(str)
}
