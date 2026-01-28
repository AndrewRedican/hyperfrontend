/**
 * Generates a version 4 UUID.
 * @returns a version 4 UUID.
 */
export function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    // Generate a random hexadecimal digit, 0 - 15
    const randomHex = (Math.random() * 16) | 0

    // Use the randomHex for 'x' and a specific subset for 'y'
    const finalHex = char === 'x' ? randomHex : (randomHex & 0x3) | 0x8

    // Convert the final hexadecimal digit to a string
    return finalHex.toString(16)
  })
}

/**
 * Validate if a string is a version 4 UUID.
 * @param str the string to be validated.
 * @returns true if the string is a version 4 UUID, otherwise false.
 */
export function isUuidV4(str: string): boolean {
  const pattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
  return pattern.test(str)
}
